import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthenticatedUserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role!: Role;

  @ApiProperty({ type: String })
  createdAt!: Date;
}

export class AuthResponseDto {
  /** Short-lived JWT for API calls */
  @ApiProperty()
  accessToken!: string;

  /** Long-lived token used to obtain new access tokens */
  @ApiProperty()
  refreshToken!: string;

  /** Snapshot of the authenticated user used by the client */
  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}
