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

export interface PublishedArtifact {
  artifactId: string;
  version: number;
}

@Injectable()
export class ArtifactRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async publish(
    artifact: NewArtifact,
    version: NewArtifactVersion,
  ): Promise<PublishedArtifact> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.artifact.findFirst({
        where: { slackThreadId: artifact.slackThreadId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, latestVersion: true },
      });
      if (!existing) {
        const { id } = await tx.artifact.create({
          data: artifact,
          select: { id: true },
        });
        await tx.artifactVersion.create({
          data: { ...version, artifactId: id, version: 1 },
        });
        return { artifactId: id, version: 1 };
      }

      const nextVersion = existing.latestVersion + 1;
      const { count } = await tx.artifact.updateMany({
        where: { id: existing.id, latestVersion: existing.latestVersion },
        data: { latestVersion: nextVersion, title: artifact.title },
      });
      if (count === 0)
        throw new Error(`artifact ${existing.id} changed while publishing`);
      await tx.artifactVersion.create({
        data: { ...version, artifactId: existing.id, version: nextVersion },
      });
      return { artifactId: existing.id, version: nextVersion };
    });
  }

  async findLatestHtmlInThread(
    slackThreadId: string,
  ): Promise<string | undefined> {
    const artifactVersion = await this.prismaService.artifactVersion.findFirst({
      where: { artifact: { slackThreadId, deletedAt: null } },
      orderBy: [{ artifact: { createdAt: 'desc' } }, { version: 'desc' }],
      select: { html: true },
    });
    return artifactVersion?.html;
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
