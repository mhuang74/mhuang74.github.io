+++
title = "Visualize NYC 311 Call Stats via Zola"
description = "Play with chart.xkcd and vega-lite"
date = 2022-04-09

[taxonomies]
categories = ["Technical"]
tags = ["chart", "open data", "zola"]
+++

I want to explore rendering charts via static site generators. Here are a couple of libraries that are easy to integrate with [Zola](https://www.getzola.org/).

In this post, I plot open data from NYC 311 call records using:

* [chart.xkcd](https://timqian.com/chart.xkcd/) - a chart library that plots “sketchy”, “cartoony” or “hand-drawn” styled charts.

* [vega-lite](https://vega.github.io/vega-lite/) - a high-level grammar of interactive graphics.

Raw data is available [here](/data.csv), or viewed interactively via my test post on [DataTables](@/posts/test_table.md).

Here's a peek at raw csv data.

```
Unique Key,Created Date,Closed Date,Agency,Agency Name,Complaint Type,Descriptor,Location Type,Incident Zip,Incident Address,Street Name,Cross Street 1,Cross Street 2,Intersection Street 1,Intersection Street 2,Address Type,City,Landmark,Facility Type,Status,Due Date,Resolution Description,Resolution Action Updated Date,Community Board,BBL,Borough,X Coordinate (State Plane),Y Coordinate (State Plane),Open Data Channel Type,Park Facility Name,Park Borough,Vehicle Type,Taxi Company Borough,Taxi Pick Up Location,Bridge Highway Name,Bridge Highway Direction,Road Ramp,Bridge Highway Segment,Latitude,Longitude,Location
42254749,04/18/2019 09:55:45 PM,04/19/2019 03:45:24 AM,NYPD,New York City Police Department,Noise - Residential,Banging/Pounding,Residential Building/House,11235,3855 SHORE PARKWAY,SHORE PARKWAY,BRAGG STREET,BELT PARKWAY WB KNAPP STREET EN,,,ADDRESS,BROOKLYN,,Precinct,Closed,04/19/2019 05:55:45 AM,The Police Department responded to the complaint and with the information available observed no evidence of the violation at that time.,04/19/2019 03:45:24 AM,15 BROOKLYN,3088060140,BROOKLYN,1002973,152924,PHONE,Unspecified,BROOKLYN,,,,,,,,40.5863974,-73.9325913,"(40.5863974, -73.9325913)"
16561258,05/01/2010 09:59:44 AM,05/01/2010 10:24:07 AM,NYPD,New York City Police Department,Traffic/Illegal Parking,Posted Parking Sign Violation,Street/Sidewalk,10019,WEST 55 STREET,WEST 55 STREET,9 AVENUE,10 AVENUE,,,BLOCKFACE,NEW YORK,,Precinct,Closed,05/01/2010 05:59:44 PM,The Police Department responded and upon arrival those responsible for the condition were gone.,05/01/2010 10:24:07 AM,04 MANHATTAN,,MANHATTAN,987551,218794,PHONE,Unspecified,MANHATTAN,,,,,,,,40.7672147,-73.9880831,"(40.7672147, -73.9880831)"
46412656,05/21/2020 06:15:38 PM,05/21/2020 06:33:51 PM,NYPD,New York City Police Department,Non-Emergency Police Matter,Face Covering Violation,Store/Commercial,11205,241 TAAFFE PLACE,TAAFFE PLACE,WILLOUGHBY AVENUE,DEKALB AVENUE,WILLOUGHBY AVENUE,DEKALB AVENUE,,BROOKLYN,TAAFFE PLACE,,Closed,,The Police Department responded to the complaint and took action to fix the condition.,05/21/2020 10:34:01 PM,03 BROOKLYN,3019250001,BROOKLYN,995466,191079,ONLINE,Unspecified,BROOKLYN,,,,,,,,40.69113738107441,-73.95955540938948,"(40.69113738107441, -73.95955540938948)"
40039013,08/17/2018 03:25:16 PM,08/20/2018 09:21:15 AM,HPD,Department of Housing Preservation and Development,PLUMBING,WATER SUPPLY,RESIDENTIAL BUILDING,10462,2132 WALLACE AVENUE,WALLACE AVENUE,,,,,ADDRESS,BRONX,,N/A,Closed,,The following complaint conditions are still open. HPD may attempt to contact you to verify the correction of the condition or may conduct an inspection.,08/20/2018 09:21:15 AM,11 BRONX,2042920024,BRONX,1021647,250439,PHONE,Unspecified,BRONX,,,,,,,,40.8539929,-73.8648172,"(40.8539929, -73.8648172)"
33913755,07/23/2016 10:09:54 AM,07/23/2016 03:10:37 PM,NYPD,New York City Police Department,Noise - Residential,Banging/Pounding,Residential Building/House,11367,79-25 150 STREET,150 STREET,79 AVENUE,UNION TURNPIKE,,,ADDRESS,FLUSHING,,Precinct,Closed,07/23/2016 06:09:54 PM,The Police Department reviewed your complaint and provided additional information below.,07/23/2016 03:10:37 PM,08 QUEENS,4067120001,QUEENS,1036022,201509,MOBILE,Unspecified,QUEENS,,,,,,,,40.7196209,-73.8132317,"(40.7196209, -73.8132317)"
18556060,08/25/2010 12:00:00 AM,09/12/2010 12:00:00 AM,HPD,Department of Housing Preservation and Development,PLUMBING,WATER-LEAKS,RESIDENTIAL BUILDING,11385,64-19 WOODBINE STREET,WOODBINE STREET,64 STREET,TRAFFIC AVENUE,,,ADDRESS,RIDGEWOOD,,N/A,Closed,,The Department of Housing Preservation and Development inspected the following conditions. Violations were issued. Information about specific violations is available at www.nyc.gov/hpd.,09/12/2010 12:00:00 AM,0 Unspecified,4036170055,Unspecified,1013387,197397,UNKNOWN,Unspecified,Unspecified,,,,,,,,,,
34961688,12/08/2016 03:45:20 PM,12/16/2016 07:55:09 AM,DOT,Department of Transportation,Broken Muni Meter,Timer Defect - Fast/Fail,Street,11217,64 7 AVENUE,7 AVENUE,LINCOLN PLACE,BERKELEY PLACE,,,ADDRESS,BROOKLYN,,N/A,Closed,12/28/2016 03:45:20 PM,"The Department of Transportation inspected the condition you reported. You can find additional information in the ""Notes to Customer"" field.",12/16/2016 07:55:09 AM,06 BROOKLYN,3009517501,BROOKLYN,991255,185391,PHONE,Unspecified,BROOKLYN,,,,,,,,40.6755294,-73.9747461,"(40.6755294, -73.9747461)"
20227197,04/13/2011 09:34:46 AM,04/13/2011 10:05:57 AM,DPR,Department of Parks and Recreation,Root/Sewer/Sidewalk Condition,Sidewalk Consultation,Street,11375,63-61 YELLOWSTONE BOULEVARD,YELLOWSTONE BOULEVARD,63 DRIVE,64 AVENUE,,,ADDRESS,FOREST HILLS,,N/A,Closed,05/13/2011 09:58:26 AM,"The agency has mailed literature to the customer concerning the Sidewalk Consultation, and is currently evaluating the request.",04/13/2011 10:05:57 AM,06 QUEENS,4021480001,QUEENS,1025253,206273,PHONE,Unspecified,QUEENS,,,,,,,,40.7327533,-73.8520519,"(40.7327533, -73.8520519)"
16296482,03/23/2010 07:20:41 PM,12/02/2013 12:00:00 AM,DOB,Department of Buildings,Special Projects Inspection Team (SPIT),Illegal Hotel Rooms In Residential Building,,11230,1305 EAST 19 STREET,EAST 19 STREET,AVENUE L,AVENUE M,,,ADDRESS,BROOKLYN,,N/A,Closed,,"The Department of Buildings determined that the conditions described in this complaint were addressed under another service request number. Click on ""Learn More"" in the ""Did You Know"" section below for more information.",12/02/2013 12:00:00 AM,14 BROOKLYN,3067390001,BROOKLYN,996377,164759,UNKNOWN,Unspecified,BROOKLYN,,,,,,,,,,
```

<!-- more -->

## [chart.xkcd](https://timqian.com/chart.xkcd/)

[chart.xkcd](https://timqian.com/chart.xkcd/) comes integrated with [deep-thought](https://github.com/RatanShreshtha/DeepThought) theme. It uses JSON to define axis and dataset, but does not come with any data loading APIs.

Since I don't want to write data wrangling code via javscript, I manually enter pre-aggregated complaint counts into JSON definition below.

Chart is generated via the `chart()` shortcode, which is defined in `themes/deep-thought/templates/shortcodes/chart.html`, and doesn't do much besides creating the the svg container and passing along the JSON definition.



__chart() short code__
```html
<svg class="chart">{{body | safe}}</svg>
```


__call chart() shortcode with JSON definition to generate chart__
* note: escaped `{%` and `%}` due to Zola rendering issues
```json
\{% chart() %\}
{
  "type": "Bar",
  "title": "Top 10 NYC 311 Complaint Types",
  "xLabel": "Complaint Type",
  "yLabel": "Count",
  "data": {
    "labels": ["Noise - Residential", "Heat/Hot Water", "Illegal Parking", "Street Condition", "Blocked Driveway", "Street Light Condition", "Plumbing", "Heating", "Water System", "Nosie - Street/Sidewalk"],
    "datasets": [
      {
        "data": [162, 129, 91, 86, 85, 71, 70, 70, 63, 63]
      }
    ]
  }
}
\{% end %\}
```

__output__
{% chart() %}
{
  "type": "Bar",
  "title": "Top 10 NYC 311 Complaint Types",
  "xLabel": "Complaint Type",
  "yLabel": "Count",
  "data": {
    "labels": ["Noise - Residential", "Heat/Hot Water", "Illegal Parking", "Street Condition", "Blocked Driveway", "Street Light Condition", "Plumbing", "Heating", "Water System", "Nosie - Street/Sidewalk"],
    "datasets": [
      {
        "data": [162, 129, 91, 86, 85, 71, 70, 70, 63, 63]
      }
    ]
  }
}
{% end %}

Overall, chart.xkcd is simple to use, looks nice, and tooltip works out of the box.

## [vega-lite](https://vega.github.io/vega-lite/)

It is fairly easy to integrate [vega-lite](https://vega.github.io/vega-lite/) into Zola.

First, override theme base template `base.html` to include vega-related javascript libraries in header. Zola support overriding either at file or block level. I hijacked a predefined block in the header section called `user_custom_stylesheet` which works just fine for my purpose.

__templates/base.html__
```html
{% extends "deep-thought/templates/base.html" %}

{% block user_custom_stylesheet %}
{% if config.extra.vega_chart.enabled %}
<script src="https://cdn.jsdelivr.net/npm/vega@5.21.0" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-lite@5.2.0" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-embed@6.20.2" crossorigin="anonymous"></script>
{% endif %}
{% endblock %}
```

`vega_chart()` invokes custom shortcode defined in `templates/shortcodes/vega_chart.html`, which just creates a div container and passes along the javascript body. Chart is defined via vega-lite spec expressed in JSON format. Javascript code takes the JSON spec and calls [vega-embed](https://github.com/vega/vega-embed) api to compile and render the view.

__vega_chart() shortcode__
```html
<div id="{{id}}"></div>
<script>{{body | safe}}</script>
```

__call vega_chart() shortcode with Javascript body to render chart__
* Note: vega-lite spec is expressed in JSON format
```js
\{% vega_chart(id="vis") %\}

    // Assign the specification to a local variable vlSpec.
    var vlSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"url": "/data.csv"},
        "transform": [
          {
            "aggregate": [{
                "op": "count",
                "field": "Complaint Type",
                "as": "Complaint_Count",
            }],
            "groupby": ["Complaint Type"],

          },
        ],
        "mark": {
            "type": "bar",
            "tooltip": true
        },
        "encoding": {
            "x": {
                "field": "Complaint Type",
                "type": "ordinal",
                "bin": false, 
                "sort": "-y"
            },
            "y": {
                "field": "Complaint_Count",
                "type": "quantitative",
                "sort": "-y"
            }
        }
    };


    // Embed the visualization in the container with id `vis`
    vegaEmbed('#vis', vlSpec).then(function(result) {
    // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
    }).catch(console.error);

\{% end %\}
```

{% vega_chart(id="vis") %}

    // Assign the specification to a local variable vlSpec.
    var vlSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"url": "/data.csv"},
        "transform": [
          {
            "aggregate": [{
                "op": "count",
                "field": "Complaint Type",
                "as": "Complaint_Count",
            }],
            "groupby": ["Complaint Type"],

          },
        ],
        "mark": {
            "type": "bar",
            "tooltip": true
        },
        "encoding": {
            "x": {
                "field": "Complaint Type",
                "type": "ordinal",
                "bin": false, 
                "sort": "-y"
            },
            "y": {
                "field": "Complaint_Count",
                "type": "quantitative",
                "sort": "-y"
            }
        }
    };

    // Embed the visualization in the container with id `vis`
    vegaEmbed('#vis', vlSpec).then(function(result) {
    // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
    }).catch(console.error);

{% end %}


vega-lite offers vastly more flexibility in terms of data aggregation, sorting, filtering, and rendering options, but it's also harder to debug. For example, I notice that the x-axis labels are rotated 90 degrees automatically for readability.

Here's an attempt to filter for top complaint counts (> 50) by adding a __filter__ step in __transform__.
Doesn't work. Looks like filter is being applied to csv data stream instead of output of aggregate.

```json
        "transform": [
          {
            "aggregate": [{
                "op": "count",
                "field": "Complaint Type",
                "as": "Complaint_Count",
            }],
            "groupby": ["Complaint Type"],

          },
          {
            "filter": [{
                "field": "Complaint_Count",
                "gt": 50
            }]
          }
        ],

```

### Summary

I think both libraries have their usecases. I would use chart.xkcd to illustrate a point that only requires a few synthetic data points. Meanwhile, vega-lite's data aggregation, sorting, and filtering options makes it much more versatile for use with real datasets.