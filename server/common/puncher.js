// Show puncher statistics
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    stats_id:   { format: 'mongo' },
    secret_key: { type: 'string', required: true }
  });

  N.wire.on(apiPath, async function puncher_stats(env) {
    let stats = await N.models.core.PuncherStats.findOne()
                          .where('_id').equals(env.params.stats_id)
                          .where('secret_key').equals(env.params.secret_key)
                          .lean(true);

    if (!stats) throw N.io.NOT_FOUND;

    env.res.puncher_stats = JSON.parse(stats.data);
  });
};
