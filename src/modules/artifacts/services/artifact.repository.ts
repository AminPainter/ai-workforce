import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/services/prisma.service.js';

export interface NewArtifact {
  title: string;
  slackThreadId: string;
  requestedBySlackUserId: string;
}

export interface NewArtifactVersion {
  html: string;
  sha256: string;
  sizeBytes: number;
  model: string;
}

@Injectable()
export class ArtifactRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    artifact: NewArtifact,
    version: NewArtifactVersion,
  ): Promise<string> {
    return this.prismaService.$transaction(async (tx) => {
      const { id } = await tx.artifact.create({
        data: artifact,
        select: { id: true },
      });
      await tx.artifactVersion.create({
        data: { ...version, artifactId: id, version: 1 },
      });
      return id;
    });
  }

  async findLatestHtml(id: string): Promise<string> {
    const artifactVersion = await this.prismaService.artifactVersion.findFirst({
      where: { artifactId: id, artifact: { deletedAt: null } },
      orderBy: { version: 'desc' },
      select: { html: true },
    });
    if (!artifactVersion)
      throw new NotFoundException(`artifact ${id} not found`);
    return artifactVersion.html;
  }
}
