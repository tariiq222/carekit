import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { EmbedDocumentHandler } from './embed-document/embed-document.handler';
import { SemanticSearchHandler } from './semantic-search/semantic-search.handler';
import { ChatCompletionHandler } from './chat-completion/chat-completion.handler';
import { ManageKnowledgeBaseHandler } from './manage-knowledge-base/manage-knowledge-base.handler';

const handlers = [
  EmbedDocumentHandler,
  SemanticSearchHandler,
  ChatCompletionHandler,
  ManageKnowledgeBaseHandler,
];

@Module({
  imports: [DatabaseModule],
  providers: handlers,
  exports: handlers,
})
export class AiModule {}
