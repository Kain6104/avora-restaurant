export class CreateCommentDto {
  content: string;
  parentId?: string;
}

export class UpdateCommentDto {
  content: string;
}
