'use strict';

let domains = [
  // img-fotki.yandex.ru
  [ /^img\-fotki\.yandex\.ru$/,       { conn: 60, rate: '30/s' } ],

  // www.youtube.com, youtube.com
  [ /^(?:www\.)?youtube\.com$/,       { conn: 60, rate: '30/s' } ],

  // youtu.be
  [ /^youtu\.be$/,                    { conn: 60, rate: '30/s' } ],

  // s019.radikal.ru, s017.radikal.ru, etc.
  [ /^.*\.radikal\.ru$/,              { conn: 20, rate: '10/s' } ],

  // lh3.googleusercontent.com, lh4.googleusercontent.com, etc.
  [ /^.*\.googleusercontent\.com$/,   { conn: 20, rate: '10/s' } ],

  // pp.vk.me
  [ /^pp\.vk\.me$/,                   { conn: 20, rate: '10/s' } ],

  // content.foto.mail.ru, content.foto.my.mail.ru, cloud.mail.ru,
  // files.mail.ru, foto.mail.ru, video.mail.ru, my.mail.ru
  [ /^.*\.mail\.ru$/,                 { conn: 20, rate: '10/s' } ]
];

let default_domain_config = { conn: 8, rate: '4/s' };


module.exports.max_connections = function max_connections(domain) {
  for (let [ regexp, config ] of domains) {
    if (regexp.test(domain)) return config.conn;
  }

  return default_domain_config.conn;
};

module.exports.rate = function rate(domain) {
  for (let [ regexp, config ] of domains) {
    if (regexp.test(domain)) return config.rate;
  }

  return default_domain_config.rate;
};
