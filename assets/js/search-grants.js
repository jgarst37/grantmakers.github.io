---
---
function ready(fn) {
  if (document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function() {
  // Helper definitions
  const scrollAnchor = document.querySelector('.nav-search');
  const isMobile = window.matchMedia('only screen and (max-width: 992px)');
  // Initialize Materialize components
  // Note: if the element is created dynamically via Instantsearch widget,
  // the plugin needs to be initialized in the normal Instantsearch workflow
  // using the render method (e.g. search.on('render'...)
  const elemsPA = document.querySelectorAll('.parallax');
  M.Parallax.init(elemsPA);

  const elemsSN = document.querySelectorAll('.sidenav');
  M.Sidenav.init(elemsSN);

  const elemsMO = document.querySelectorAll('.modal');
  M.Modal.init(elemsMO);

  if (!isMobile.matches) { // Use pushpin on desktop only
    const elemPP = document.querySelector('.nav-search nav');
    const optionsPP = {
      'top': elemPP.offsetTop,
    };
    M.Pushpin.init(elemPP, optionsPP);
  }

  const searchClient = algoliasearch('QA1231C5W9', '{{ site.algolia_public_key_grants }}');
  const facets = [
    {
      'facet': 'grantee_name',
      'label': 'Recipient',
    },
    {
      'facet': 'organization_name',
      'label': 'Donor',
    },
    {
      'facet': 'grantee_city',
      'label': 'City',
    },
    {
      'facet': 'grantee_state',
      'label': 'State',
    },
    {
      'facet': 'grant_amount',
      'label': 'Amount',
    },
  ];

  // Define toggle helpers
  const toggleParent = document.getElementById('search-toggle');
  const toggle = toggleParent.querySelector('select');

  // Ensure initial toggle state set to grants search
  toggle.value = 'grants';

  // Toggle search type
  toggle.onchange = function() {
    console.log('switch');
    window.location.href = '/search/profiles/';
  };

  const search = instantsearch({
    'indexName': 'grantmakers_io',
    searchClient,
    'numberLocale': 'en-US',
    'searchParameters': {
      'hitsPerPage': 12,
    },
    // 'routing': true,
    'routing': {
      'stateMapping': {
        stateToRoute({query, refinementList, range, page}) { // could also use stateToRoute(uiState)
          return {
            'query': query,
            'grantee_name':
              refinementList &&
              refinementList.grantee_name &&
              refinementList.grantee_name.join('~'),
            'organization_name':
              refinementList &&
              refinementList.organization_name &&
              refinementList.organization_name.join('~'),
            'grantee_city':
              refinementList &&
              refinementList.grantee_city &&
              refinementList.grantee_city.join('~'),
            'grantee_state':
              refinementList &&
              refinementList.grantee_state &&
              refinementList.grantee_state.join('~'),
            'grant_amount':
              range &&
              range.grant_amount &&
              range.grant_amount.replace(':', '~'),
            'page': page,
          };
        },
        routeToState(routeState) {
          return {
            'query': routeState.query,
            'refinementList': {
              'grantee_name': routeState.grantee_name && routeState.grantee_name.split('~'),
              'organization_name': routeState.organization_name && routeState.organization_name.split('~'),
              'grantee_city': routeState.grantee_city && routeState.grantee_city.split('~'),
              'grantee_state': routeState.grantee_state && routeState.grantee_state.split('~'),
            },
            'range': {
              'grant_amount': routeState.grant_amount && routeState.grant_amount.replace('~', ':'),
            },
            'page': routeState.page,
          };
        },
      },
    },
  });

  // Define templates
  const templateHitsEmpty = `{% include search/grants/algolia-template-hits-empty.html %}`;
  const templateStats = `{% include search/algolia-template-stats.html %}`;

  // Grants
  const templateHits = `{% include search/grants/algolia-template-hits.html %}`;

  // Construct widgets
  search.addWidget(
    instantsearch.widgets.searchBox({
      'container': '#ais-widget-search-box',
      'placeholder': 'Search by keywords, location, or grantee name',
      'autofocus': true,
      'showSubmit': true,
      'showReset': true,
      'showLoadingIndicator': false,
      'queryHook': function(query, searchInstance) {
        const queryCleaned = checkForEIN(query);
        readyToSearchScrollPosition();
        searchInstance(queryCleaned);
        initTooltips();
      },
    })
  );

  search.addWidget(
    instantsearch.widgets.poweredBy({
      'container': '#powered-by',
    })
  );

  // Grants search
  search.addWidget(
    instantsearch.widgets.hits({
      'container': '#ais-widget-hits',
      'templates': {
        'item': templateHits,
        'empty': templateHitsEmpty,
      },
      'cssClasses': {
        'root': '',
        'list': 'striped row',
        'item': ['col', 's12', 'li-grants-search'],
      },
      transformItems(items) {
        return items.map(item => ({
          ...item,
          'grant_amount': `$${item.grant_amount.toLocaleString()}`,
        }));
      },
    })
  );

  search.addWidget(
    instantsearch.widgets.stats({
      'container': '#ais-widget-stats',
      'templates': {
        'text': templateStats,
      },
      'cssClasses': {
        'text': 'text-muted',
      },
    })
  );

  search.addWidget(
    instantsearch.widgets.currentRefinements({
      'container': '#ais-widget-current-refined-values',
      'includedAttributes': ['grantee_name', 'organization_name', 'grantee_city', 'grantee_state', 'grant_amount'],
      'cssClasses': {
        'list': 'list-inline',
        'item': ['btn', 'blue-grey'],
        'label': ['small'],
        'categoryLabel': 'text-bold',
        'delete': 'blue-grey-text',
      },
      transformItems(items) {
        return items.map(item => ({
          ...item,
          'label': getLabel(item),
        }));
      },
    })
  );

  const rangeSliderWithPanel = instantsearch.widgets.panel({
    'templates': {
      'header': 'Amount',
    },
    hidden(options) {
      return options.results.nbHits === 0;
    },
    'cssClasses': {
      'root': 'card',
      'header': [
        'card-header',
        // 'grey',
        // 'lighten-4',
      ],
      'body': 'card-content',
    },
  })(instantsearch.widgets.rangeInput);

  /* Range Slider */
  search.addWidget(
    rangeSliderWithPanel({
      'container': '#ais-widget-range-slider',
      'attribute': 'grant_amount',
      // 'min': 0,
      // 'max': 500000000,
      'tooltips': {
        'format': function(rawValue) {
          return `$${numberHuman(rawValue, 0)}`;
        },
      },
      'pips': false,
      'cssClasses': {
        'submit': ['btn-flat', 'blue-grey', 'white-text'],
      },
    })
  );

  /* Create all other refinements */
  facets.forEach((refinement) => {
    // Amount handled by range widget
    if (refinement.facet === 'grant_amount') {
      return;
    }
    const refinementListWithPanel = instantsearch.widgets.panel({
      'templates': {
        'header': refinement.label,
      },
      hidden(options) {
        return options.results.nbHits === 0;
      },
      'cssClasses': {
        'root': 'card',
        'header': [
          'card-header',
          // 'grey',
          // 'lighten-4',
        ],
        'body': 'card-content',
      },
    })(instantsearch.widgets.refinementList);

    // TODO DRY it up
    // Hiding on mobile as grants search refinements not useful on mobile
    /*
    const mobileRefinementListWithPanel = instantsearch.widgets.panel({
      'templates': {
        'header': refinement.label,
      },
      hidden(options) {
        return options.results.nbHits === 0;
      },
      'cssClasses': {
        'root': 'card',
        'header': [
          'card-header',
          'blue-grey',
          'lighten-4',
        ],
        'body': 'card-content',
      },
    })(instantsearch.widgets.refinementList);
    */
    
    /* Create desktop refinements */
    search.addWidget(
      refinementListWithPanel({
        'container': `#ais-widget-refinement-list--${refinement.facet}`,
        'attribute': refinement.facet,
        'limit': 8,
        'showMore': false,
        // 'searchable': true,
        'cssClasses': {
          'checkbox': 'filled-in',
          'labelText': 'small',
          'count': ['right', 'small'],
          // 'selectedItem': ['grants-search-text'],
          // 'searchableRoot': 'ais-SearchBox-refinements',
          // 'searchableSubmit': 'hidden',
        },
      })
    );

    /* Create mobile refinements */
    /* Hiding on mobile as grants search refinements not useful on mobile
    search.addWidget(
      mobileRefinementListWithPanel({
        'container': `#ais-widget-mobile-refinement-list--${refinement.facet}`,
        'attribute': refinement.facet,
        'limit': 8,
        'showMore': false,
        'cssClasses': {
          'checkbox': 'filled-in',
          'count': ['right', 'small'],
          'selectedItem': ['grantmakers-text'],
        },
      })
    );
    */
  });

  search.addWidget(
    instantsearch.widgets.clearRefinements({
      'container': '#ais-widget-clear-all',
      'cssClasses': {
        'button': ['btn blue-grey waves-effect waves-light'],
      },
      'templates': {
        'resetLabel': 'Clear filters',
      },
    })
  );

  search.addWidget(
    instantsearch.widgets.pagination({
      'container': '#ais-widget-pagination',
      'maxPages': 20,
      'scrollTo': '.nav-search',
      'cssClasses': {
        'root': 'pagination',
        'page': 'waves-effect',
        'selectedItem': 'active',
        'disabledItem': 'disabled',
      },
    })
  );

  // Initialize Materialize JS components created by Instantsearch widgets
  search.once('render', function() {
    // Search toggle
    initSelect();
  });

  search.on('render', function() {
    // Tooltips
    initTooltips();
    initModals();
  });

  search.on('error', function(e) {
    if (e.statusCode === 429) {
      renderRateLimit();
      console.log('Rate limit reached');
    }
    if (e.statusCode === 403) {
      renderForbidden();
      console.log('Origin forbidden');
    }
  });

  // Initialize search
  search.start();

  // Materialize init helpers
  function initTooltips() {
    const elems = document.querySelectorAll('.tooltipped');
    const options = {
      'position': 'top',
      'exitDelay': 0, // Default is 0
      'enterDelay': 100, // Default is 200
      'inDuration': 300, // Default is 300
      'outDuration': 250, // Default is 250
    };
    M.Tooltip.init(elems, options);
  }

  function initModals() {
    const elems = document.querySelectorAll('.modal');
    M.Modal.init(elems);
  }

  function initSelect() {
    const elem = document.querySelectorAll('select');
    const options = {
      'classes': 'btn blue-grey white-text',
    };
    M.FormSelect.init(elem, options);
  }
  

  // QUERY HOOKS
  // ==============
  // Handle EINs entered in searchbox with a hyphen
  function checkForEIN(query) {
    // Base Regex: /^[0-9]{2}\-\d{7}$/g;
    // Assume query is an EIN as soon as 2 digits entered after hyphen
    const regexEIN = /^[0-9]{2}\-\d{2}/g;
    const isEIN = regexEIN.test(query);
    if (query.includes('-') && isEIN) {
      // TODO Will remove hyphen if query ALSO includes prohibit string (e.g. -foo 12-3456789)
      // TODO Add toast - will assist with any confusion caused by routing:true setting...
      // ...which autoupdates the url withOUT the hyphen
      return query.replace('-', '');
    } else {
      return query;
    }
  }

  // Scroll to top of results upon input change
  function readyToSearchScrollPosition() {
    window.scrollTo({
      'top': scrollAnchor.offsetTop,
      'left': 0,
      'behavior': 'auto',
    });
  }

  function renderRateLimit() {
    const message = document.getElementById('rate-limit-message');
    message.classList.remove('hidden');

    const results = document.getElementById('algolia-hits-wrapper');
    results.classList.add('hidden');
  }

  function renderForbidden() {
    const message = document.getElementById('forbidden-message');
    message.classList.remove('hidden');

    const results = document.getElementById('algolia-hits-wrapper');
    results.classList.add('hidden');
  }
  // MISC HELPER FUNCTIONS
  // ==============
  function getLabel(item) {
    const obj = facets.filter(each => each.facet === item.attribute);
    return obj[0].label;
  }

  function numberHuman(num, decimals) {
    if (num === null) { return null; } // terminate early
    if (num === 0) { return '0'; } // terminate early
    if (isNaN(num)) { return num; } // terminate early if already a string - handles edge case likely caused by cacheing
    const fixed = !decimals || decimals < 0 ? 0 : decimals; // number of decimal places to show
    const b = num.toPrecision(2).split('e'); // get power
    const k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3); // floor at decimals, ceiling at trillions
    const c = k < 1 ? num.toFixed(0 + fixed) : (num / Math.pow(10, k * 3) ).toFixed(1 + fixed); // divide by power
    const d = c < 0 ? c : Math.abs(c); // enforce -0 is 0
    const e = d + ['', 'K', 'M', 'B', 'T'][k]; // append power
    return e;
  }
});
