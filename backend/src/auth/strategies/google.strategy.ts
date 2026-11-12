import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    const callbackURL =
      process.env.GOOGLE_CALLBACK_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://avorafnb.com/api/auth/google/callback'
        : 'http://localhost:4001/api/auth/google/callback');

    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const user = {
      email: emails?.[0]?.value,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      picture: photos?.[0]?.value || '',
      googleId: id,
    };

    // Call the auth service to validate or create the user
    const validatedUser = await this.authService.validateGoogleUser(user);
    done(null, validatedUser);
  }
}
