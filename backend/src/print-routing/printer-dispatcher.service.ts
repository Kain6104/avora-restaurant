import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as net from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { PrintAgentGateway } from './print-agent.gateway';
import { EscPosEncoder } from './esc-pos.encoder';
import { PrinterStatus, PrintJobStatus } from '@prisma/client';

@Injectable()
export class PrinterDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrinterDispatcherService.name);
  private workerInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentGateway: PrintAgentGateway,
  ) {}

  onModuleInit() {
    // Start polling worker for outbox print jobs
    this.workerInterval = setInterval(() => {
      this.processOutboxJobs().catch((err) => {
        this.logger.error(`Error in processOutboxJobs: ${err.message}`);
      });
    }, 3500);
    this.logger.log('PrinterDispatcherService worker initialized');
  }

  onModuleDestroy() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
    }
  }

  /**
   * Check if any print agent is connected for the branch
   */
  isAgentOnlineForBranch(branchId: string): boolean {
    return this.agentGateway.isAgentOnlineForBranch(branchId);
  }

  /**
   * Background outbox processing worker
   */
  async processOutboxJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = await this.prisma.printJob.findMany({
        where: {
          status: PrintJobStatus.PENDING,
          attemptCount: { lt: 3 },
        },
        include: {
          printer: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      for (const job of pendingJobs) {
        await this.dispatchJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Dispatch an individual print job
   */
  async dispatchJob(job: any) {
    // Mark as PROCESSING
    await this.prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: PrintJobStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
    });

    const printer = job.printer;
    if (!printer || !printer.isActive) {
      await this.prisma.printJob.update({
        where: { id: job.id },
        data: {
          status: PrintJobStatus.FAILED,
          errorMessage: 'Máy in không hoạt động hoặc không tồn tại',
        },
      });
      return;
    }

    // Determine payload
    let rawBuffer: Buffer | null = null;
    if (job.payloadData) {
      try {
        rawBuffer = Buffer.from(job.payloadData, 'base64');
      } catch {
        rawBuffer = null;
      }
    }

    if (!rawBuffer) {
      // Fallback: encode text from contentHtml or snapshot
      const encoder = new EscPosEncoder();
      encoder.align('center').bold(true).line('AVORA RESTAURANT');
      encoder.align('left').bold(false).line(job.contentHtml.replace(/<[^>]+>/g, '\n'));
      encoder.feed(2).cut();
      rawBuffer = encoder.toBuffer();
    }

    // Dispatch via network or agent
    if (printer.connectionType === 'NETWORK_DIRECT') {
      if (!printer.ipAddress) {
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.FAILED,
            errorMessage: 'Máy in thiếu địa chỉ IP',
          },
        });
        return;
      }

      const result = await this.sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, rawBuffer);

      if (result.success) {
        await this.markJobSuccess(job.id, printer.id, job.orderItemId, job.quantityDelta);
      } else if (result.isUnknown) {
        // Handled as UNKNOWN (timeout after connect) - Do not auto retry to prevent kitchen duplicate tickets
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.UNKNOWN,
            errorMessage: result.error,
          },
        });
        await this.prisma.printer.update({
          where: { id: printer.id },
          data: {
            status: PrinterStatus.ERROR,
            lastError: result.error,
          },
        }).catch(() => {});
      } else {
        // Connection refused / unreachable
        const newStatus = job.attemptCount >= 3 ? PrintJobStatus.FAILED : PrintJobStatus.PENDING;
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: newStatus,
            errorMessage: result.error,
          },
        });
        await this.prisma.printer.update({
          where: { id: printer.id },
          data: {
            status: PrinterStatus.OFFLINE,
            lastError: result.error,
          },
        }).catch(() => {});
      }
    } else if (printer.connectionType === 'PRINT_AGENT') {
      if (!printer.agentId) {
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.FAILED,
            errorMessage: 'Máy in chưa được gán Print Agent',
          },
        });
        return;
      }

      const agentOnline = this.agentGateway.isAgentOnline(printer.agentId);
      if (!agentOnline) {
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.PENDING,
            errorMessage: 'Print Agent đang offline, chờ kết nối lại',
          },
        });
        return;
      }

      const success = await this.agentGateway.sendJobToAgent(printer.agentId, {
        jobId: job.id,
        printerId: printer.id,
        payloadBase64: job.payloadData,
        copies: job.copies,
      });

      if (success) {
        await this.markJobSuccess(job.id, printer.id, job.orderItemId, job.quantityDelta);
      } else {
        await this.prisma.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.FAILED,
            errorMessage: 'Agent phản hồi in thất bại',
          },
        });
      }
    }
  }

  private async markJobSuccess(jobId: string, printerId: string, orderItemId?: string | null, delta?: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.printJob.update({
        where: { id: jobId },
        data: {
          status: PrintJobStatus.PRINTED,
          printedAt: new Date(),
          errorMessage: null,
        },
      });

      await tx.printer.update({
        where: { id: printerId },
        data: {
          status: PrinterStatus.ONLINE,
          lastSeenAt: new Date(),
          lastPrintAt: new Date(),
          lastError: null,
        },
      });

      // Update printedQuantity on orderItem
      if (orderItemId && delta && delta > 0) {
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            printedQuantity: { increment: delta },
          },
        }).catch(() => {});
      }
    });
  }

  /**
   * Direct TCP socket client with timeout protection
   */
  async sendToNetworkPrinter(
    ip: string,
    port: number,
    data: Buffer,
    timeoutMs: number = 3500,
  ): Promise<{ success: boolean; isUnknown?: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          socket.destroy();
          if (connected) {
            // Data was written or connection was established but timed out before clean finish
            resolve({
              success: false,
              isUnknown: true,
              error: `Lệnh in timeout sau khi kết nối tới ${ip}:${port} (${timeoutMs}ms). Vui lòng kiểm tra giấy máy in.`,
            });
          } else {
            resolve({
              success: false,
              isUnknown: false,
              error: `Không thể kết nối tới máy in ${ip}:${port} trong ${timeoutMs}ms`,
            });
          }
        }
      }, timeoutMs);

      socket.connect(port, ip, () => {
        connected = true;
        socket.write(data, (err) => {
          if (err) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              socket.destroy();
              resolve({ success: false, isUnknown: true, error: `Lỗi ghi dữ liệu tới máy in: ${err.message}` });
            }
          } else {
            // Data written successfully
            socket.end();
          }
        });
      });

      socket.on('close', (hadError) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          if (hadError) {
            resolve({ success: false, isUnknown: connected, error: 'Kết nối máy in đóng với lỗi' });
          } else {
            resolve({ success: true });
          }
        }
      });

      socket.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          socket.destroy();
          resolve({
            success: false,
            isUnknown: connected,
            error: `Lỗi mạng máy in: ${err.message}`,
          });
        }
      });
    });
  }

  /**
   * Test print command to verify printer
   */
  async testPrint(printerId: string): Promise<{ success: boolean; message: string }> {
    const printer = await this.prisma.printer.findUnique({
      where: { id: printerId },
    });

    if (!printer) {
      return { success: false, message: 'Không tìm thấy máy in' };
    }

    const encoder = new EscPosEncoder();
    encoder.align('center');
    encoder.bold(true).size(2, 2).line('AVORA TEST PRINT');
    encoder.size(1, 1).bold(false);
    encoder.line(`May in: ${printer.name}`);
    encoder.line(`IP: ${printer.ipAddress || 'Agent'} : ${printer.port}`);
    encoder.line(`Thoi gian: ${new Date().toLocaleString('vi-VN')}`);
    encoder.separator('=', 32);
    encoder.line('Kiem tra ket noi thanh cong!');
    encoder.line('In nhiet hoat dong tot.');
    encoder.feed(2);
    encoder.cut();

    const buffer = encoder.toBuffer();

    if (printer.connectionType === 'NETWORK_DIRECT') {
      if (!printer.ipAddress) {
        return { success: false, message: 'Máy in thiếu IP' };
      }
      const res = await this.sendToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer, 3000);
      if (res.success) {
        await this.prisma.printer.update({
          where: { id: printer.id },
          data: { status: PrinterStatus.ONLINE, lastSeenAt: new Date(), lastPrintAt: new Date(), lastError: null },
        });
        return { success: true, message: 'In test thành công' };
      } else {
        await this.prisma.printer.update({
          where: { id: printer.id },
          data: { status: PrinterStatus.ERROR, lastError: res.error },
        });
        return { success: false, message: res.error || 'Lỗi in test' };
      }
    } else {
      if (!printer.agentId) {
        return { success: false, message: 'Chưa cấu hình Agent cho máy in này' };
      }
      const success = await this.agentGateway.sendJobToAgent(printer.agentId, {
        printerId: printer.id,
        payloadBase64: buffer.toString('base64'),
        copies: 1,
      });
      return {
        success,
        message: success ? 'Đã gửi lệnh test tới Print Agent' : 'Không thể gửi lệnh tới Print Agent',
      };
    }
  }
}
