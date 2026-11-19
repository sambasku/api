/**
 * Controller late yang dipakai lebih dari satu domain registrar.
 * Diinstansiasi sekali di modul ini supaya tidak ada duplikasi wiring.
 */
import * as di from '../container';
import { SetWordImageContentWarningsUseCase } from '@/modules/word/application/use-cases/set-word-image-content-warnings.use-case';
import { CreateWordReportUseCase } from '@/modules/word-report/application/use-cases/create-word-report.use-case';
import { ListWordReportsUseCase } from '@/modules/word-report/application/use-cases/list-word-reports.use-case';
import {
  ResolveWordReportUseCase,
  TakedownWordReportUseCase,
  RemoveMeaningWordReportUseCase,
  FlagViolentImageReportUseCase,
} from '@/modules/word-report/application/use-cases/resolve-word-report.use-case';
import { WordReportController } from '@/modules/word-report/presentation/v1/word-report.controller';
import { UploadPublicImageUseCase } from '@/modules/public-image/application/use-cases/upload-public-image.use-case';
import { PublicImageController } from '@/modules/public-image/presentation/v1/public-image.controller';

const setWordImageContentWarnings = new SetWordImageContentWarningsUseCase(
  di.wordRepo,
  di.auditRepo,
);

export const wordReportController = new WordReportController({
  create: new CreateWordReportUseCase(di.wordReportRepo, di.wordRepo, di.auditRepo),
  list: new ListWordReportsUseCase(di.wordReportRepo),
  resolve: new ResolveWordReportUseCase(di.wordReportRepo, di.auditRepo),
  takedown: new TakedownWordReportUseCase(di.wordReportRepo, di.takedownWord),
  flagViolentImage: new FlagViolentImageReportUseCase(
    di.wordReportRepo,
    setWordImageContentWarnings,
    di.auditRepo,
  ),
  removeMeaning: new RemoveMeaningWordReportUseCase(
    di.wordReportRepo,
    di.softDeleteMeaning,
  ),
});

export const publicImageController = new PublicImageController({
  uploadPublicImage: new UploadPublicImageUseCase(di.publicImageStorage),
});
