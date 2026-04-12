import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class SemanticSearchDto {
  @IsString() @MinLength(1) query!: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) topK?: number;
  @IsOptional() @IsUUID() documentId?: string;
}

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}
