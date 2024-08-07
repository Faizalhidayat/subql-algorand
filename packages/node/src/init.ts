// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { NestFactory } from '@nestjs/core';
import { findAvailablePort } from '@subql/common';
import { exitWithError, getLogger, NestLogger } from '@subql/node-core';
import { AppModule } from './app.module';
import { FetchService } from './indexer/fetch.service';
import { yargsOptions } from './yargs';
const pjson = require('../package.json');

const { argv } = yargsOptions;

const DEFAULT_PORT = 3000;
const logger = getLogger('subql-node');

export async function bootstrap(): Promise<void> {
  logger.info(`Current ${pjson.name} version is ${pjson.version}`);

  const validate = (x: any) => {
    const p = parseInt(x);
    return isNaN(p) ? null : p;
  };

  const port = validate(argv.port) ?? (await findAvailablePort(DEFAULT_PORT));
  if (!port) {
    exitWithError(
      `Unable to find available port (tried ports in range (${port}..${
        port + 10
      })). Try setting a free port manually by setting the --port flag`,
      logger,
    );
  }

  if (argv.unsafe) {
    logger.warn(
      'UNSAFE MODE IS ENABLED. This is not recommended for most projects and will not be supported by our hosted service',
    );
  }

  try {
    const app = await NestFactory.create(AppModule, {
      logger: new NestLogger(!!argv.debug),
    });
    await app.init();

    const projectService = app.get('IProjectService');
    const fetchService = app.get(FetchService);

    await projectService.init();
    await fetchService.init(projectService.startHeight);

    app.enableShutdownHooks();

    await app.listen(port);

    logger.info(`Node started on port: ${port}`);
  } catch (e) {
    exitWithError(new Error('Node failed to start', { cause: e }), logger);
  }
}
