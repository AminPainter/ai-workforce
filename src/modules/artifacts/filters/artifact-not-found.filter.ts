import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ARTIFACT_RESPONSE_HEADERS } from '../constants/artifact-response-headers.js';

const NOT_FOUND_HTML =
  '<!doctype html><html><head><title>Not found</title></head><body><p>Not found</p></body></html>';

@Catch(NotFoundException)
export class ArtifactNotFoundFilter implements ExceptionFilter {
  catch(_exception: NotFoundException, host: ArgumentsHost): void {
    void host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .headers(ARTIFACT_RESPONSE_HEADERS)
      .code(404)
      .send(NOT_FOUND_HTML);
  }
}
