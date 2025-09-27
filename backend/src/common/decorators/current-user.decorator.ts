import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

type CurrentUserResult<TProperty extends keyof AuthUser | undefined> =
  TProperty extends keyof AuthUser ? AuthUser[TProperty] : AuthUser;

export const CurrentUser = createParamDecorator(
  <TProperty extends keyof AuthUser | undefined>(
    property: TProperty,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request?.user;

    if (!user) {
      return undefined;
    }

    if (!property) {
      return user as CurrentUserResult<TProperty>;
    }

    return user[property] as CurrentUserResult<TProperty>;
  },
);
