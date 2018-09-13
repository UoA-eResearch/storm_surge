var map = L.map('map', {
    center: [-41.235726,172.5118422],
    zoom: 5,
    minZoom: 5,
});
var bounds = map.getBounds();
bounds._northEast.lat += 10;
bounds._northEast.lng += 10;
bounds._southWest.lat -= 10;
bounds._southWest.lng -= 10;
map.setMaxBounds(bounds);

var baseMaps = {
    "OSM": L.tileLayer.provider("OpenStreetMap.Mapnik"),
    "OSM Grayscale": L.tileLayer.provider("OpenStreetMap.BlackAndWhite"),
    "CartoDB Positron": L.tileLayer.provider('CartoDB.Positron'),
    "CartoDB Dark Matter": L.tileLayer.provider("CartoDB.DarkMatter"),
    "ESRI WorldImagery": L.tileLayer.provider("Esri.WorldImagery"),
    "Google Hybrid": L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3']
    }),
    "Wikimedia": L.tileLayer.provider("Wikimedia")
};

baseMaps["CartoDB Positron"].addTo(map);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
var subset;
var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        poly: {
            allowIntersection: false
        }
    },
    draw: {
        polygon: {
            allowIntersection: false,
            showArea: true
        },
        marker: false,
        circlemarker: false,
        polyline: false,
        circle: false
    }
});
map.addControl(drawControl);

var markers = L.layerGroup().addTo(map);

function drawHandler(e) {
    console.log(e);
    var layer;
    if (e.layers) {
        e.layers.eachLayer(function (l) {
            layer = l;
            return false;
        });
    } else if (e.layer) {
        layer = e.layer;
    }
    console.log(layer);
    if (subset) {
        drawnItems.removeLayer(subset);
    }
    drawnItems.addLayer(layer);
    subset = layer;
    var count = 0;
    if (e.layerType == "circle") {
        var center = layer.getLatLng();
        var radius = layer.getRadius();
        markers.eachLayer(function(marker) {
            var markerll = marker.getLatLng();
            var dist = markerll.distanceTo(center);
            if (dist <= radius) {
                count++;
            }
        });
    } else {
        markers.eachLayer(function(marker) {
            if (layer.contains(marker.getLatLng())) {
                count++;
            }
        });
    }
    console.log(count + " points in ", layer);
    $("#selected_points").text(count);

}

map.on(L.Draw.Event.CREATED, drawHandler);
map.on(L.Draw.Event.EDITED, drawHandler);
map.on(L.Draw.Event.DELETESTOP, function() {
    subset = null;
    $("#selected_points").text(0);
    console.log("draw deleted");
})

var overlays = {
    "Drawn Items": drawnItems,
    "Markers": markers,
}

L.control.layers(baseMaps, overlays).addTo(map);

var legend = L.control({position: 'topright'});
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend');
    var html = '<select id="model"><option value="Model_20CR">Model 20CR (Past)</option>';
    var models = ["ACCESS10", "BCC-CSM", "CSIRO", "EC_EARTH", "GFDL", "INM-CM4", "MIROC5"];
    var submodels = ["Historical", "rcp4.5", "rcp8.5"]
    for (var i in models) {
        for (var j in submodels) {
            var model = models[i];
            var submodel = submodels[j];
            var combo = model + " - " + submodel;
            html += "<option>" + combo + "</option>";
        }
    }
    html += '</select><br><span id="selected_points">0</span> points selected. <button id="download">Download</button><div id="download_status"></div>';
    div.innerHTML = html;
    div.firstChild.onmousedown = div.firstChild.ondblclick = L.DomEvent.stopPropagation;
    return div;
};
legend.addTo(map);

function getColor(value){
    //value from 0 to 1
    return "hsl(" + (1 - value) * 250 + ",100%,50%)";
}

var baseUrl = "https://r.nectar.auckland.ac.nz/storm/";

function fetchDataForModel(model, minDate, maxDate) {
    if (!maxDate) {
        maxDate = minDate;
    }
    console.log("fetching", baseUrl, model, minDate, maxDate);
    $.getJSON(baseUrl, { model: model, minDate: minDate, maxDate: maxDate }, function(data) {
        console.log("Got " + data.results.length + " results for " + model)
        markers.clearLayers();
        var minHeight = Infinity;
        var maxHeight = -Infinity;
        for (var i in data.results) {
            var e = data.results[i];
            if (e.height < minHeight) minHeight = e.height;
            if (e.height > maxHeight) maxHeight = e.height;
        }
        for (var i in data.results) {
            var e = data.results[i];
            var desc = e.lat + "," + e.lng + " = " + e.height + "m";
            var normalised_height = (e.height - minHeight) / (maxHeight - minHeight);
            var color = getColor(normalised_height)
            var marker = L.circleMarker([e.lat, e.lng], {radius: 4, color: color}).addTo(markers).bindTooltip(desc);
        }
    })
}

function fetchRangesForModel(model) {
    $.getJSON(baseUrl + "ranges", { model: model }, function(data) {
        dataset.update({id: 1, content: model, start: data.minDate, end: data.maxDate});
        var ct = timeline.getCustomTime(1);
        if (ct < new Date(data.minDate) || ct > new Date(data.maxDate)) {
            timeline.setCustomTime(data.minDate, 1);
            timeline.setWindow(data.minDate, data.maxDate);
        }
        fetchDataForModel(model, data.minDate);
    })
}

$("#model").change(function(e) {
    window.model = this.value;
    fetchRangesForModel(this.value);
});

window.model = "Model_20CR";

fetchRangesForModel("Model_20CR")

$("#download").click(function() {
    var dt = timeline.getCustomTime(1).formatYYYYMMDD() + " 12:00";
    var payload = {
        minDate: dt,
        maxDate: dt,
        model: window.model,
    }
    if (subset) {
        wkt = Terraformer.WKT.convert(subset.toGeoJSON().geometry);
        console.log(wkt);
        payload.bounds = wkt;
    }
    $("#download_status").text("Preparing export...");
    $.getJSON(baseUrl + "?format=csv", payload, function(data) {
        var url = baseUrl + data.url;
        $("#download_status").html('Your export is ready for download - please click <a href="' + url + '">here</a> to download');
    });
})

// DOM element where the Timeline will be attached
var container = document.getElementById('timeline');

var dataset = new vis.DataSet([
    {id: 1, content: 'Data range', start: '1871-1-1 12:00', end: '2100-1-1 12:00'},
]);

// Configuration for the Timeline
var options = {
    width: "100%",
    min: "1800-1-1",
    max: "2200-1-1",
    zoomable: true,
    zoomMin: 1000 * 60 * 60 * 24 * 7
};

// Create a Timeline
var timeline = new vis.Timeline(container, dataset, options);

timeline.addCustomTime("1871-1-1 12:00", 1);

Date.prototype.formatYYYYMMDD = function(){
    var day = ("0" + this.getDate()).slice(-2);
    var month = ("0" + (this.getMonth() + 1)).slice(-2);
    var year = this.getFullYear();
    return year + "-" + month + "-" + day;
}

timeline.on('timechanged', function(e) {
    e.time.setHours(12, 0, 0, 0);
    timeline.setCustomTime(e.time, 1);
    var dateString = e.time.formatYYYYMMDD() + " 12:00";
    console.log("timechange", e, dateString);
    fetchDataForModel(window.model, dateString);
});