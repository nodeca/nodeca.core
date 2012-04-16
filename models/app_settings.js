'use strict';

/*global nodeca*/

module.exports = new nodeca.runtime.mongoose.Schema({
  app_name: { type: String },
  settings: { type: nodeca.runtime.mongoose.Schema.Types.Mixed, default: {}}
});



module.exports.__init__ = function () {
  return nodeca.runtime.mongoose.model('app-settings', module.exports);
};
