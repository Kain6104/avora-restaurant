import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import * as fs from 'fs';

interface UploadedFilePayload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}

@Controller('admin/upload')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UploadController {
  @Post()
  @RequirePermission('admin.access')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, callback) => {
        let folder = (req.query.folder as string) || 'others';
        // Validate folder name to prevent path traversal
        folder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
        const dest = `./uploads/${folder}`;
        
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        callback(null, dest);
      },
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req, file, callback) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
        return callback(new BadRequestException('Only image files (jpg, jpeg, png, gif, webp, svg, ico) are allowed!'), false);
      }
      callback(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  }))
  uploadFile(@UploadedFile() file: UploadedFilePayload, @Query('folder') folderQuery: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    let folder = folderQuery || 'others';
    folder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    
    return {
      url: `/api/uploads/${folder}/${file.filename}`,
      message: 'File uploaded successfully'
    };
  }
}
