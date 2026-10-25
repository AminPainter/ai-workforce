import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ArtifactRepository } from '../services/artifact.repository.js';
import { ARTIFACT_RESPONSE_HEADERS } from '../constants/artifact-response-headers.js';
import { ArtifactNotFoundFilter } from '../filters/artifact-not-found.filter.js';

const artifactIdSchema = z.uuidv4();

@Controller('artifacts')
@UseFilters(ArtifactNotFoundFilter)
export class ArtifactsController {
  constructor(private readonly artifactRepository: ArtifactRepository) {}

  @Get(':id')
  async show(
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!artifactIdSchema.safeParse(id).success)
      throw new NotFoundException('invalid artifact id');
    const html = await this.artifactRepository.findLatestHtml(id);
    await reply.headers(ARTIFACT_RESPONSE_HEADERS).code(200).send(html);
  }
}
