# ZNY TRACON Airspace Visualization
Display TRACON airspace boundaries and shelves on Leaflet/OSM map layer. Additional options for displaying SIDs, STARs, and video maps.\
<b>FOR FLIGHT SIMULATION PURPOSES ONLY</b>


(I'm really bad at writing documentation)

## Features
### Searching
Search will find string matches for either file names, or airports/specific positions. IE: Typing `JFK` will pull up all Kennedy files, and `FQM3` will only show the FQM3 arrival.
### URL Linking
Selected `sectors`, `procedures`, and `videomaps` will generate a unique URL that can be shared and loaded to the specific configuration. Individual position selections in a sector file will also be reflected in the URL. 
### Feature Info
Additional information pertaining to a sector's airspace or notes on a procedure will appear when hovered over. Airspace limits for `sectors` are also displayed.

## Installation
```
Copy/Fork/Download and run
```

## Structure
`Procedures` refers to SID/STARs\
`Sectors` refer to airspace owned by a position(s)

All files must be in the `GEOJSON` format and contain a `FeatureCollection`. Below are two examples of [FQM3 STAR](data/ewr/stars/FQM3.geojson) and [EWR SW](data/ewr/sectors/EWR_SW.json) files, addition language is provided below. Videomaps follow the same format but do not need extra `properties` as their geometry is only rendered.

The general file structure is as follows: [`data/`](data) is the parent file where everything should be stored. Each folder under `data/` represents a unique <i>option or group</i> such as [`JFK`](data/jfk/). This folder appears as dropdown selectors initially on the left side menu.\
Under that folder contains `sector` which provides the airspace, `sid` and `star` which contain the procedures, and `videomap` containing the videomap(s). There can be one or none files located under the parent folder, and these will appear in the dropdown when selecting the parent option. Files under these folders provide the `togglable options` to turn a layer/sector/area/procedure's visibility on or off. `Sector` files have another feature that allows individual groups of geometries/polgons to be toggled. Polygons that have the same name property or position will be grouped and toggled together.

<b>If new files are added or existing names are changed, [file-index.json](data/file-index.json) must be updated to incorporate the changes for the files to be loaded.</b> This can be done automatically via [gen-file-index](src/gen-file-index.py) or manually by the user.

```
{
    "type": "FeatureCollection",        
    "name": "FQM3",                     # This will appear in the as an option
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "SLT",
                "altitudes": [],
                "speed": [],
                "notes": null,
                "color": "#ff0000"      # Lines and markers will be this color
            },
            "geometry": {
                "type": "Point",
                "coordinates": [
                    -77.97010972,
                    41.51275944
                ]
            }
        }
    ]
}

{
    "type": "FeatureCollection",        
    "name": "Southwest",
    "features": [
        {
            "type": "Feature",
            "id": 1,
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [...]
                ]
            },
            "properties": {
                "OBJECTID": 1,
                "Position": "N4N",
                "Low": 7000,
                "High": 7000,
                "Notes": null,
                "Fill": "#BED2FF",      # Area/Stroke will be this color with differing opacity
                "Stroke": "#BED2FF"     # Unused at the moment
            }
        },
    ]
}
```

### Geometry
`Procedures` require two parts, a Point which represents a NAVAID/Fix present and linestring connecting them together. LineStrings be combined into one geometry and will be rendered together. Points need to be seperate as each may/need have constraints/names.

`Sectors` are standard FeatureCollections of multiple polygons. It is not recommended to utilize MultiPolygons as this can break some mechanics.

`Videomaps` are rendered as is, ie no style changes or extras. This should be a FeatureCollection of linestrings.

### Naming Scheme
The name of the file that appears in the selection menu is taken from a `name` property under the `FeatureCollection` if present, else it uses the full file name.
```
{
    "type": "FeatureCollection",
    "name": "This will appear in the menu if entered.",
    "features": [..]
}
```

### Coloring
`Procedures` utilize the `color` property is present, else uses a default black. This color affects the outline of the infobox and changes the outline of the icon if a `note` is present. `Sectors` utilize both a `fill` and `stroke` to define colors for the area and outline of the airspace.\
The color option for `sectors` is also utilized for the cursor information box. <b>Bright colors will be adjusted to black to preserve readability.</b>\
Recommend to use the same color for both, and will use the same color if only one is present/entered.
```
"color": "#ff0000"      # Procedures will use this color

"Fill": "#BED2FF",      # Area/Stroke will be this color with differing opacity for stroke
"Stroke": "#BED2FF"
```

### Restrictions/Constraints
`Procedures` will display route restrictions for both altitude and speed. `@120 = at 120` `+120 = at or above 120` `-120 = at or below 120`. Format is the same for speed restrictions.
```
"altitudes": ['@120'],
"speed": ['+180K', '-220'],
```

`Sector` will display the airspace ownership. Numbers will be formated into three digits, zero(s) will be converted to SFC. Single altitudes are also handled, does not matter which one it is in.
```
"Low": 7000,
"High": 7000,

"Low": 0, -> 'SFC'
"High": 7000,

"Low": 7000,
"High": nil,
```

### Notes
Notes for `Procedures` and `Sectors` will appears on the top right of the cursor.

Contact kevinw@nyartcc.org for questions/comments/concerns/inquiries.