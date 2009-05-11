/*
 * Copyright (c) 2008 Justin Britten justinbritten at gmail.com
 *
 * Some code was borrowed from:
 * 1. Greg Weber's uiTableFilter project (http://gregweber.info/projects/uitablefilter)
 * 2. Denny Ferrassoli & Charles Christolini's TypeWatch project (www.dennydotnet.com)
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */


(function($) {
  $.extend({
    tablesorterFilter: new function() {

      // Default filterFunction implementation (element text, search words, case-sensitive flag, OR mode instead of AND)
      function has_words(str, words, caseSensitive, orMode) {
        var text = caseSensitive ? str : str.toLowerCase();

        if(orMode) {
          for (var i=0; i < words.length; i++) {
            if (words[i].charAt(0) == '-') {
              if (text.indexOf(words[i].substr(1)) != -1) return false; // Negated word must not be in text
            } else if (text.indexOf(words[i]) != -1) return true; // Normal word may be in text
          }
          return false;
        } else {
          for (var i=0; i < words.length; i++) {
            if (words[i].charAt(0) == '-') {
              if (text.indexOf(words[i].substr(1)) != -1) return false; // Negated word must not be in text
            } else if (text.indexOf(words[i]) == -1) return false; // Normal word must be in text
          }
          return true;
        }
      }


      function doFilter(table) {
        if(table.config.debug) { var cacheTime = new Date(); }

        // Build multiple filters from input boxes
        // TODO: enable incremental filtering by caching result and applying only single filter action
        var filters = [];
        for(var i=0; i < table.config.filter.length; i++) {
          var container = $(table.config.filter[i].filterContainer);
          // Trim and unify whitespace before splitting
          var phrase = jQuery.trim(container.val()).replace(/\s+/g, ' ');
          if(phrase.length != 0) {
            var caseSensitive = table.config.filter[i].filterCaseSensitive;

            // Should only several columns be filtered?
            var findStr = '';
            if(table.config.filterColumn !== null) {
              // If single column should be filtered, skip all filters without this column
              if(table.config.filter[i].filterColumns && $.inArray(table.config.filterColumn, table.config.filter[i].filterColumns) == -1)
                continue;
              findStr = "td:eq(" + table.config.filterColumn + ")";
            } else if(table.config.filter[i].filterColumns) {
              findStr = "td:eq(" + table.config.filter[i].filterColumns.join("),td:eq(") + ")";
            }

            filters.push({
              caseSensitive: caseSensitive,
              words: caseSensitive ? phrase.split(" ") : phrase.toLowerCase().split(" "),
              findStr: findStr,
              filterFunction: table.config.filter[i].filterFunction,
              orMode: table.config.filter[i].filterOrMode
            });
          }
        }
        var filterCount = filters.length;

        // Filter cleared?
        if(filterCount == 0) {
          var search_text = function() {
            var elem = jQuery(this);
            resultRows[resultRows.length] = elem;
          }
        } else {
          var search_text = function() {
            var elem = jQuery(this);
            for(var i=0; i < filterCount; i++) {
              if(! filters[i].filterFunction( (filters[i].findStr ? elem.find(filters[i].findStr) : elem).text(), filters[i].words, filters[i].caseSensitive, filters[i].orMode)) {
                return true; // Skip elem and continue to next element
              }
            }
            resultRows[resultRows.length] = elem;
          }
        }

        // Walk through all of the table's rows and search.
        // Rows which match the string will be pushed into the resultRows array.
        var allRows = table.config.cache.row;
        var resultRows = [];

        var allRowsCount = allRows.length;
        for (var i=0; i < allRowsCount; i++) {
          allRows[i].each ( search_text );
        }

        // Clear the table
        $.tablesorter.clearTableBody(table);

        // Push all rows which matched the search string onto the table for display.
        var resultRowsCount = resultRows.length;
        for (var i=0; i < resultRowsCount; i++) {
          $(table.tBodies[0]).append(resultRows[i]);
        }

        // Update the table by executing some of tablesorter's triggers
        // This will apply any widgets or pagination, if used.
        $(table).trigger("update");
        if (resultRows.length) {
          $(table).trigger("appendCache");
          // Apply current sorting after restoring rows
          $(table).trigger("sorton", [table.config.sortList]);
        }

        if(table.config.debug) { $.tablesorter.benchmark("Apply filter", cacheTime); }

        // Inform subscribers that filtering finished
        $(table).trigger("filterEnd");

        return table;
      };

      function clearFilter(table) {
        if(table.config.debug) { var cacheTime = new Date(); }

        // Reset all filter values
        for(var i=0; i < table.config.filter.length; i++)
          $(table.config.filter[i].filterContainer).val('').get(0).lastValue = '';

        var allRows = table.config.cache.row;

        $.tablesorter.clearTableBody(table);

        for (var i=0; i < allRows.length; i++) {
          $(table.tBodies[0]).append(allRows[i]);
        }

        $(table).trigger("update");
        $(table).trigger("appendCache");
        // Apply current sorting after restoring all rows
        $(table).trigger("sorton", [table.config.sortList]);

        if(table.config.debug) { $.tablesorter.benchmark("Clear filter:", cacheTime); }

        $(table).trigger("filterCleared");

        return table;
      };

      // Set single column index to be filtered (null restores specified filterColumns)
      // Automatically starts filtering afterwards
      function setFilterColumn(table, i) {
        if(i === null || ! isNaN(parseInt(i)) && i >= 0) {
          table.config.filterColumn = parseInt(i);
          doFilter(table);
        }
      }

      this.defaults = {
        filterContainer: '#filter-box',
        filterClearContainer: '#filter-clear-button',
        filterColumns: null,
        filterCaseSensitive: false,
        filterWaitTime: 500,
        filterFunction: has_words,
        filterOrMode: false,
        filterColumn: null
      };


      this.construct = function() {
        var settings = arguments; // Allow multiple config objects in constructor call

        // Ensure default filter values if no parameters have been passed
        if(! settings.length)
          settings = [{}];

        return this.each(function() {
          this.config.filter = new Array(settings.length);
          var config = this.config;
          config.filter = new Array(settings.length);
          config.filterColumn = null;

          for (var i = 0; i < settings.length; i++) {
            config.filter[i] = $.extend(this.config.filter[i], $.tablesorterFilter.defaults, settings[i]);

            // Allow constructor object to initialize filterColumn
            if(config.filter[i].filterColumn !== null)
              config.filterColumn = config.filter[i].filterColumn;
            delete config.filter[i].filterColumn;
          }

          var table = this;

          // Create a timer which gets reset upon every keyup event.
          //
          // Perform filter only when the timer's wait is reached (user finished typing or paused long enough to elapse the timer).
          //
          // Do not perform the filter is the query has not changed.
          //
          // Immediately perform the filter if the ENTER key is pressed.

          function checkInputBox(inputBox, override) {
            var value = inputBox.value;

            if ((value != inputBox.lastValue) || (override)) {
              inputBox.lastValue = value;
              doFilter( table );
            }
          };

          var timer = new Array(settings.length);

          for (var i = 0; i < settings.length; i++) {
            var container = $(config.filter[i].filterContainer);
            // TODO: throw error for non-existing filter container?
            if(container.length)
              container[0].filterIndex = i;
            container.keyup(function(e, phrase) {
              var index = this.filterIndex;
              if(undefined !== phrase)
                $(this).val(phrase);
              var inputBox = this;

              // Was ENTER pushed?
              if (inputBox.keyCode == 13 || undefined !== phrase) {
                var timerWait = 1;
                var overrideBool = true;
              } else {
                var timerWait = config.filter[index].filterWaitTime || 500;
                var overrideBool = false;
              }

              var timerCallback = function() {
                checkInputBox(inputBox, overrideBool);
              }

              // Reset the timer
              clearTimeout(timer[index]);
              timer[index] = setTimeout(timerCallback, timerWait);

              return false;
            });

            // Avoid binding click event to whole document if no clearContainer has been defined
            if(config.filter[i].filterClearContainer) {
              var container = $(config.filter[i].filterClearContainer);
              if(container.length) {
                container[0].filterIndex = i;
                container.click(function() {
                  var index = this.filterIndex;
                  var container = $(config.filter[index].filterContainer);
                  container.val("");
                  // Support entering the same filter text after clearing
                  container[0].lastValue = "";
                  // TODO: Clear single filter only
                  doFilter(table);
                  if(container[0].type != 'hidden')
                    container.focus();
                });
              }
            }
          }

          // Example: $("table").trigger("doFilter");
          $(table).bind("doFilter",function() {
            doFilter(table);
          });
          // Example: $("table").trigger("clearFilter");
          $(table).bind("clearFilter",function() {
            clearFilter(table);
          });
          // Example: $("table").trigger("filterColumn", 2);
          $(table).bind("filterColumn",function(event, i) {
            setFilterColumn(table, i);
          });
        });
      };

    }
  });

  // extend plugin scope
  $.fn.extend({
    tablesorterFilter: $.tablesorterFilter.construct
  });

})(jQuery);