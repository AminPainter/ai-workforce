import { Controller, Get, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ArtifactRepository } from '../services/artifact.repository.js';
import { ARTIFACT_RESPONSE_HEADERS } from '../constants/artifact-response-headers.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND_HTML =
  '<!doctype html><html><head><title>Not found</title></head><body><p>Not found</p></body></html>';

@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifactRepository: ArtifactRepository) {}

  @Get(':id')
  async show(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const html = UUID_PATTERN.test(id)
      ? await this.artifactRepository.findLatestHtml(id)
      : undefined;
    reply.headers(ARTIFACT_RESPONSE_HEADERS);
    if (html === undefined) await reply.code(404).send(NOT_FOUND_HTML);
    else await reply.code(200).send(html);
  }
}
