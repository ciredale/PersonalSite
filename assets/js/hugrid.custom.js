var $event = $.event,
  $special,
  resizeTimeout;

$special = $event.special.debouncedresize = {
  setup: function () {
    $(this).on('resize', $special.handler);
  },
  teardown: function () {
    $(this).off('resize', $special.handler);
  },
  handler: function (event, execAsap) {
    var context = this,
      args = arguments,
      dispatch = function () {
        event.type = 'debouncedresize';
        $event.dispatch.apply(context, args);
      };

    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    execAsap
      ? dispatch()
      : (resizeTimeout = setTimeout(dispatch, $special.threshold));
  },
  threshold: 250
};

var BLANK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

$.fn.videosLoaded = function (callback) {
  var $this = this,
    deferred = typeof $.Deferred === 'function' ? $.Deferred() : 0,
    hasNotify = typeof deferred.notify === 'function',
    $videos = $this.find('video').add($this.filter('video')),
    loaded = [],
    proper = [],
    broken = [];

  if ($.isPlainObject(callback)) {
    $.each(callback, function (key, value) {
      if (key === 'callback') {
        callback = value;
      } else if (deferred) {
        deferred[key](value);
      }
    });
  }

  function doneLoading() {
    var $proper = $(proper),
      $broken = $(broken);

    if (deferred) {
      if (broken.length) {
        deferred.reject($videos, $proper, $broken);
      } else {
        deferred.resolve($videos);
      }
    }

    if (typeof callback === 'function') {
      callback.call($this, $videos, $proper, $broken);
    }
  }

  function videoLoaded(video, isBroken) {
    if (video.src === BLANK || $.inArray(video, loaded) !== -1) {
      return;
    }

    loaded.push(video);

    if (isBroken) {
      broken.push(video);
    } else {
      proper.push(video);
    }

    $.data(video, 'videosLoaded', { isBroken: isBroken, src: video.src });

    if (hasNotify) {
      deferred.notifyWith($(video), [isBroken, $videos, $(proper), $(broken)]);
    }

    if ($videos.length === loaded.length) {
      setTimeout(doneLoading);
      $videos.off('.videosLoaded');
    }
  }

  if (!$videos.length) {
    doneLoading();
  } else {
    $videos
      .on('loadeddata.videosLoaded error.videosLoaded', function (event) {
        videoLoaded(event.target, event.type === 'error');
      })
      .each(function (i, el) {
        var src = el.src;

        var cached = $.data(el, 'videosLoaded');
        if (cached && cached.src === src) {
          videoLoaded(el, cached.isBroken);
          return;
        }

        if (el.readyState >= 3) {
          videoLoaded(el, el.videoWidth === 0 || el.videoHeight === 0);
          return;
        }

        if (el.readyState || el.complete) {
          el.src = BLANK;
          el.src = src;
        }
      });
  }

  return deferred ? deferred.promise($this) : $this;
};

var Grid = (function () {
  var $grid = $('*#og-grid'),
    $items = $grid.children('li'),
    current = -1,
    previewPos = -1,
    scrollExtra = 0,
    marginExpanded = 10,
    $window = $(window),
    winsize,
    $body = $('html, body'),
    transEndEventNames = {
      WebkitTransition: 'webkitTransitionEnd',
      MozTransition: 'transitionend',
      OTransition: 'oTransitionEnd',
      msTransition: 'MSTransitionEnd',
      transition: 'transitionend'
    },
    transEndEventName = transEndEventNames[Modernizr.prefixed('transition')],
    support = Modernizr.csstransitions,
    settings = {
      minHeight: 500,
      speed: 350,
      easing: 'ease'
    };

  function init(config) {
    settings = $.extend(true, {}, settings, config);

    $grid.videosLoaded(function () {
      saveItemInfo(true);
      getWinSize();
      initEvents();
    });
  }

  function addItems($newitems) {
    $items = $items.add($newitems);

    $newitems.each(function () {
      var $item = $(this);
      $item.data({
        offsetTop: $item.offset().top,
        height: $item.height()
      });
    });

    initItemsEvents($newitems);
  }

  function saveItemInfo(saveheight) {
    $items.each(function () {
      var $item = $(this);
      $item.data('offsetTop', $item.offset().top);
      if (saveheight) {
        $item.data('height', $item.height());
      }
    });
  }

  function initEvents() {
    initItemsEvents($items);

    $window.on('debouncedresize', function () {
      scrollExtra = 0;
      previewPos = -1;
      saveItemInfo();
      getWinSize();
      var preview = $.data(this, 'preview');
      if (typeof preview != 'undefined') {
        hidePreview();
      }
    });
  }

  function initItemsEvents($items) {
    $items
      .on('click', 'span.og-close', function () {
        hidePreview();
        return false;
      })
      .children('a')
      .on('click', function (e) {
        var $item = $(this).parent();
        current === Array.from($items).findIndex((d) => d == $item[0])
          ? hidePreview()
          : showPreview($item);
        return false;
      });
  }

  function getWinSize() {
    winsize = { width: $window.width(), height: $window.height() };
  }

  function showPreview($item) {
    var preview = $.data(this, 'preview'),
      position = $item.data('offsetTop');

    scrollExtra = 0;

    if (typeof preview != 'undefined') {
      if (previewPos !== position) {
        if (position > previewPos) {
          scrollExtra = preview.height;
        }
        hidePreview();
      } else {
        preview.update($item);
        return false;
      }
    }

    previewPos = position;
    preview = $.data(this, 'preview', new Preview($item));
    preview.open();
  }

  function hidePreview() {
    current = -1;
    var preview = $.data(this, 'preview');
    preview.close();
    $.removeData(this, 'preview');
  }

 function Preview($item) {
  this.$item = $item;
  this.expandedIdx = Array.from($items).findIndex((d) => d == this.$item[0]);
  this.create();
  this.update();
}

Preview.prototype = {
  create: function () {
    this.$title = $('<h3></h3>');
    this.$description = $('<p></p>');
    this.$href = $(
      '<a href="#" class="button" target="_blank" rel="noreferrer">{{ .Site.Params.buttontext }}</a>'
    );
    this.$details = $('<div class="og-details"></div>').append(
      this.$title,
      this.$description,
      this.$href
    );
    this.$loading = $('<div class="og-loading"></div>');
    this.$fullvideo = $('<div class="og-fullvideo"></div>').append(
      this.$loading
    );
    this.$closePreview = $('<span class="og-close"></span>');
    this.$previewInner = $('<div class="og-expander-inner"></div>').append(
      this.$closePreview,
      this.$fullvideo,
      this.$details
    );
    this.$previewEl = $('<div class="og-expander"></div>').append(
      this.$previewInner
    );
    this.$item.append(this.getEl());
    if (support) {
      this.setTransition();
      }
    },
    update: function ($item) {
      if ($item) {
        this.$item = $item;
      }
  
      if (current !== -1) {
        var $currentItem = $items.eq(current);
        $currentItem.removeClass('og-expanded');
        this.$item.addClass('og-expanded');
        this.positionPreview();
      }
  
      current = this.$item.index();
  
      function formatForUrl(str) {
        return str
          .replace(/_/g, '-')
          .replace(/ /g, '-')
          .replace(/:/g, '-')
          .replace(/\\/g, '-')
          .replace(/\//g, '-')
          .replace(/[^a-zA-Z0-9\-]+/g, '')
          .replace(/-{2,}/g, '-')
          .toLowerCase();
      }
  
      var $itemEl = this.$item.children('a'),
        eldata = {
          href: $itemEl.attr('href'),
          largesrc: $itemEl.data('largesrc'),
          title: $itemEl.data('title'),
          description: $(
            `#description-${formatForUrl($itemEl.data('title'))}`
          ).html(),
          buttontext: $itemEl.data('buttontext')
        };
  
      this.$title.html(eldata.title);
      this.$description.html(eldata.description);
      if (eldata.buttontext) this.$href.text(eldata.buttontext);
      else this.$href.text('{{ .Site.Params.buttontext }}');
  
      if (eldata.href) {
        this.$href.attr('href', eldata.href);
        this.$href.show();
      } else {
        this.$href.hide();
      }

      var self = this;

      if (typeof self.$largeVideo != 'undefined') {
        self.$largeVideo.remove();
      }

      if (self.$fullvideo.is(':visible')) {
        this.$loading.show();
        $('<video controls autoplay/>')
          .on('loadeddata', function () {
            var $video = $(this);
            if (
              $video.attr('src') === self.$item.children('a').data('largesrc')
            ) {
              self.$loading.hide();
              self.$fullvideo.find('video').remove();
              self.$largeVideo = $video.fadeIn(350);
              self.$fullvideo.append(self.$largeVideo);
            }
          })
          .attr('src', eldata.largesrc);
      }

      // Adjust the height of the .og-expander based on the content
      this.adjustHeight();
    },
    open: function () {
      setTimeout(
        $.proxy(function () {
          this.setHeights();
          this.positionPreview();
        }, this),
        25
      );
    },
    close: function () {
      var self = this,
        onEndFn = function () {
          if (support) {
            $(this).off(transEndEventName);
          }
          self.$item.removeClass('og-expanded');
          self.$previewEl.remove();
        };

      setTimeout(
        $.proxy(function () {
          if (typeof this.$largeVideo !== 'undefined') {
            this.$largeVideo.fadeOut('fast');
          }
          this.$previewEl.css('height', 0);
          var $expandedItem = $items.eq(this.expandedIdx);
          $expandedItem
            .css('height', $expandedItem.data('height'))
            .on(transEndEventName, onEndFn);

          if (!support) {
            onEndFn.call();
          }
        }, this),
        25
      );

      return false;
    },
    calcHeight: function () {
      var heightPreview =
          winsize.height - this.$item.data('height') - marginExpanded,
        itemHeight = winsize.height;

      if (heightPreview < settings.minHeight) {
        heightPreview = settings.minHeight;
        itemHeight =
          settings.minHeight + this.$item.data('height') + marginExpanded;
      }

      this.height = heightPreview;
      this.itemHeight = itemHeight;
    },
    setHeights: function () {
      var self = this,
        onEndFn = function () {
          if (support) {
            self.$item.off(transEndEventName);
          }
          self.$item.addClass('og-expanded');
        };

      this.calcHeight();
      this.$previewEl.css('height', this.height);
      this.$item.css('height', this.itemHeight).on(transEndEventName, onEndFn);

      if (!support) {
        onEndFn.call();
      }
    },
    positionPreview: function () {
      var position = this.$item.data('offsetTop'),
        previewOffsetT = this.$previewEl.offset().top - scrollExtra,
        scrollVal =
          this.height + this.$item.data('height') + marginExpanded <=
          winsize.height
            ? position
            : this.height < winsize.height
            ? previewOffsetT - (winsize.height - this.height)
            : previewOffsetT;

      $body.animate({ scrollTop: scrollVal }, settings.speed);
    },
    setTransition: function () {
      this.$previewEl.css(
        'transition',
        'height ' + settings.speed + 'ms ' + settings.easing
      );
      this.$item.css(
        'transition',
        'height ' + settings.speed + 'ms ' + settings.easing
      );
    },
    getEl: function () {
      return this.$previewEl;
    },
    adjustHeight: function () {
      var videoHeight = this.$fullvideo.outerHeight();
      var detailsHeight = this.$details.outerHeight();
      var newHeight = Math.max(videoHeight, detailsHeight) + 40; // Add some padding
      this.$previewEl.css('height', newHeight);
    }
  };

  return {
    init: init,
    addItems: addItems
  };
})();
$(function () {
  Grid.init();
});