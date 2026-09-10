import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const redirectURL = req.query?.redirectURL as string | undefined;
    const isDesktop = req.query?.isDesktop === 'true' || req.query?.isDesktop === true || redirectURL?.startsWith('avora-pos://');

    let state: string | undefined;
    if (redirectURL || isDesktop) {
      try {
        state = Buffer.from(JSON.stringify({ redirectURL: redirectURL || '/admin/pos', isDesktop: !!isDesktop })).toString('base64');
      } catch {
        state = undefined;
      }
    }

    return {
      state,
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}
