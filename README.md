# ZNY TRACON Airspace Visualization
Display TRACON airspace boundaries and shelves on Leaflet/OSM map layer. Additional options for displaying SIDs, STARs, and video maps.

<b>FOR FLIGHT SIMULATION PURPOSES ONLY.</b>
Not for real world navigation. This site is in no way affiliated with the FAA, New York TRACON or New York ARTCC, and no information found on this site should ever be used for real world flight planning, operation, air traffic control or air traffic management

Contact kevinw@nyartcc.org for questions/comments/concerns/inquiries.\
(I'm really bad at writing documentation)

## Features
### Searching
Search will find string matches for either file names, or airports/specific positions. IE: Typing `JFK` will pull up all Kennedy files, and `FQM3` will only show the FQM3 arrival.

### URL Linking
Selected `sectors`, `procedures`, and `videomaps` will generate a unique URL that can be shared and loaded to the specific configuration. Individual position selections in a sector file will also be reflected in the URL.

URLs are first custom encoded into a string and then compressed via [LzString](https://github.com/pieroxy/lz-string). Long URLs may cause issues in reloading.

### Feature Info
Additional information pertaining to a sector's airspace or notes on a procedure will appear when hovered over. Airspace limits for `sectors` are also displayed.

## Installation
```
Copy/Fork/Download and run
```

## Structure
All files must be in the `GEOJSON` format and contain a `FeatureCollection`. Below are two examples of the [FQM3 STAR](data/tracon/ewr/stars/FQM3.geojson) and [EWR SW](data/tracon/ewr/sectors/EWR_SW.geojson) files. Videomaps follow the same format but do not require a `properties` field as the geometry is plainly rendered.

The general file structure is as follows: [`data/`](data) is the parent file where everything should be stored. Next step down are the 'TRACON/ENROUTE' folders which contain files for the respective type. These categories are hard-coded and must be edited in the code to allow for more or removed.

Each folder under those represents a unique <i>option or group</i> such as [`JFK`](data/tracon/jfk). These folders create an unique menu option:

Under each folder contains `sector` which provides the airspace geometry, `sid` and `star` which contain the procedure(s), and `videomap` containing the videomap(s). Athough these folders are not strictly required, it is recommended.

Finally, these individual .geojson files create an option in the menu to turn a layer/sector/area/procedure's visibility on or off. TRACON `sector` files have another feature that allows individual groups of geometries/polgons to be toggled. For example, within [`JFK_4s`](data/tracon/jfk/sectors/JFK_4s.geojson), the positions `2G, 2K, 2J, 2A, etc` can be individually toggled. <b>Changes to any position's visibility will be reflected in the URL</b>. 

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
                "type": "vortac"          # What is it
                "icon": ""                # Uses the direct .svg file link. Use only either type or icon, not both
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
                "Position": "N4N",        # ID, required
                "Sector": "Depature,      # radio callsign
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
`Procedures` require two parts, a Point which represents a NAVAID/Fix present and LineString to draw connections. LineStrings be combined into one geometry and will be rendered as one. Points need to be seperate features.

`Sectors` are standard FeatureCollections of multiple polygons. It is <b>not recommended</b> to utilize MultiPolygons as this can break some mechanics.

`Videomaps` are rendered as is, ie no style changes or extras. This should be a FeatureCollection of LineStrings.

### Naming Scheme
The name of the file that appears in the selection menu is taken from a `name` property under the `FeatureCollection` if present, else it uses the full file name.
```
{
    "type": "FeatureCollection",
    "name": "This will appear as the name if entered.",
    "features": [..]
}
```

### Coloring
`Procedures` utilize the `color` property is present, else uses a default black. This color affects the outline of the infobox, the point itself, and the LineString. `Sectors` utilize both a `fill` and `stroke` to define colors for the area and outline of the airspace with differing opacity.\
The color option for `sectors` is also utilized for the cursor information box. <b>Bright colors will be adjusted to black to preserve readability.</b>\
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
The type of point or marker can be indentified via either the `type` or `icon` reference. Type is the recommended way to define it, refer to [`config`](src/config.js) for the reference table. Icon searches for the direct file name under [`here`](assets/icons/).

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
Notes for  `Sectors` will appear in the airspace description under the cursor when hovering over.

Points that have notes in them will have a thicker border to indicate, and the note will appear upon slewing over.
