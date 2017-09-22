// Show / run migrations
//
'use strict';


////////////////////////////////////////////////////////////////////////////////


exports.parserParameters  = {
  addHelp:      true,
  help:         'run migrations',
  description:  'Without args show new migrations. With ' +
                ' `--all` run all migrations.'
};

module.exports.commandLineArguments = [
  {
    args: [ '--all' ],
    options: {
      help:   'run all migrations',
      action: 'storeTrue'
    }
  }
];

module.exports.run = async function (N, args) {

  N.wire.skip('init:models', 'migrations_check');

  await N.wire.emit('init:models', N);

  /*eslint-disable no-console*/

  let Migration = N.models.Migration;

  // fetch used migrations from db
  let currentMigrations = await Migration.getLastState();

  let outstandingMigrations = Migration.checkMigrations(N, currentMigrations);

  if (outstandingMigrations.length === 0) {
    console.log(args.all  ? 'Already up-to-date.'
                          : 'You have no outstanding migrations');
    return N.wire.emit('exit.shutdown');
  }

  if (!args.all) {
    console.log(`You have ${outstandingMigrations.length} outstanding migration(s):\n`);

    outstandingMigrations.forEach(function (migration) {
      console.log(`  ${migration.appName}:${migration.step}`);
    });

    console.log('\nRun `migrate` command with `--all` to apply them.');
    return N.wire.emit('exit.shutdown');
  }

  console.log(`Applying ${outstandingMigrations.length} outstanding migration(s):\n`);

  for (let i = 0; i < outstandingMigrations.length; i++) {
    let migration = outstandingMigrations[i];

    process.stdout.write(`  ${migration.appName}:${migration.step} ... `);

    await require(migration.filename).up(N);

    console.log('OK');

        // All ok. Write step to db
    await Migration.markPassed(migration.appName, migration.step);
  }

  await N.wire.emit('exit.shutdown');
};
