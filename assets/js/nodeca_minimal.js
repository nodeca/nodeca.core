// this will be a minimal loader and runner of everything

(function () {
  yepnope({
    load: window.nodeca_init_config,
    callback: function () {
      alert('done');
    }
  });
}());
