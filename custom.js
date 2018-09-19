var map = L.map('map', {
    center: [-41.235726,172.5118422],
    zoom: 6,
    minZoom: 5,
    zoomControl: false
});
L.control.zoom({position: 'topright'}).addTo(map);
var bounds = map.getBounds();
bounds._northEast.lat += 10;
bounds._northEast.lng += 10;
bounds._southWest.lat -= 10;
bounds._southWest.lng -= 10;
map.setMaxBounds(bounds);

var baseMaps = {
    "CartoDB Positron": L.tileLayer.provider('CartoDB.PositronNoLabels'),
    "CartoDB Dark Matter": L.tileLayer.provider("CartoDB.DarkMatterNoLabels"),
    "ESRI WorldImagery": L.tileLayer.provider("Esri.WorldImagery"),
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
        },
        remove: false
    },
    draw: {
        polygon: {
            allowIntersection: false,
        },
        rectangle: {
            showArea: true,
            metric: ["km"]
        },
        marker: false,
        circlemarker: false,
        polyline: false,
        circle: false,
    }
});
L.drawLocal.draw.toolbar.buttons.polygon = 'Draw a selection polygon';
L.drawLocal.draw.toolbar.buttons.rectangle = 'Draw a selection rectangle';
L.drawLocal.edit.toolbar.buttons = {
    edit: 'Edit selection',
    editDisabled: 'No selection to edit',
    remove: 'Delete selection',
    removeDisabled: 'No selection to delete'
}

map.addControl(drawControl);

$("#download_info #control").append($(".leaflet-draw"));

var markers = L.layerGroup().addTo(map);

function updateSelection() {
    if (!subset) return;
    var count = 0;
    if (subset.layerType == "circle") {
        var center = subset.getLatLng();
        var radius = subset.getRadius();
        markers.eachLayer(function(marker) {
            var markerll = marker.getLatLng();
            var dist = markerll.distanceTo(center);
            if (dist <= radius) {
                count++;
            }
        });
    } else {
        markers.eachLayer(function(marker) {
            if (subset.contains(marker.getLatLng())) {
                count++;
            }
        });
    }
    console.log(count + " points in ", subset);
    $("#selected_points").text(count);
    updateTotalRows();
}

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
    updateSelection();
}

map.on(L.Draw.Event.CREATED, drawHandler);
map.on(L.Draw.Event.EDITED, drawHandler);
map.on(L.Draw.Event.DELETESTOP, function() {
    subset = null;
    $("#selected_points").text(0);
    console.log("draw deleted");
})


map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
var labels = L.tileLayer.provider("Stamen.TonerLabels", {pane: "labels"});
labels.addTo(map);

var overlays = {
    "Selections": drawnItems,
    "Data points": markers,
    "City labels": labels,
}

L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(map);

var legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'info legend');    var colors = [];
    for (var i = 1; i >= 0; i -= .1) {
        colors.push(getColor(i));
    }
    var colorbar = '<h3>Legend</h3><div id="colorbar"><div id="gradient" style="background-image: linear-gradient(' + colors.join(",") + ');"></div>';
    colorbar += '<div id="max" class="label">0.0725m</div><div id="mid" class="label">0.0527m</div><div id="min" class="label">-0.0328m</div>';
    colorbar += '</div>';
    div.innerHTML = colorbar;
    div.firstChild.onmousedown = div.firstChild.ondblclick = L.DomEvent.stopPropagation;
    return div;
}
legend.addTo(map);

function getColor(value){
    //value from 0 to 1
    return "hsl(" + (1 - value) * 250 + ",100%,50%)";
}

var baseUrl = "https://stormsurge.nectar.auckland.ac.nz/storm/";
var markerLookup = [];

function fetchDataForModel(model, minDate, maxDate) {
    if (!maxDate) {
        maxDate = minDate;
    }
    console.log("fetching", baseUrl, model, minDate, maxDate);
    $.getJSON(baseUrl, { model: model, minDate: minDate, maxDate: maxDate }, function(data) {
        console.log("Got " + data.results.length + " results for " + model);
        if (data.results.length == 0) return;
        var minHeight = Infinity;
        var maxHeight = -Infinity;
        for (var i in data.results) {
            var e = data.results[i];
            if (e.height < minHeight) minHeight = e.height;
            if (e.height > maxHeight) maxHeight = e.height;
        }
        var dp = 4;
        $("#colorbar #max").text(maxHeight.toFixed(dp) + "m");
        $("#colorbar #mid").text(((maxHeight - minHeight) / 2).toFixed(dp) + "m");
        $("#colorbar #min").text(minHeight.toFixed(dp) + "m");
        for (var i in data.results) {
            var e = data.results[i];
            var desc = "(" + e.lat + "°," + e.lng + "°): " + e.height.toFixed(dp) + "m";
            var normalised_height = (e.height - minHeight) / (maxHeight - minHeight);
            var color = getColor(normalised_height)
            if (markerLookup[i]) {
                markerLookup[i].setStyle({color: color}).setTooltipContent(desc);
            } else {
                var marker = L.circleMarker([e.lat, e.lng], {radius: 4, color: color, fillOpacity: 1}).addTo(markers).bindTooltip(desc);
                markerLookup[i] = marker;
            }
        }
        if (subset) {
            updateSelection();
        } else {
            $("#selected_points").text(data.results.length);
            updateTotalRows();
        }
    }).fail(function(e) {
        alert("There was an error fetching data for " + model + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

var ONE_DAY_MS = 1000 * 60 * 60 * 24;
var ONE_YEAR_MS = ONE_DAY_MS * 365;

function fetchRangesForModel(model) {
    $.getJSON(baseUrl + "ranges", { model: model }, function(data) {
        var start = new Date(data.minDate);
        var end = new Date(data.maxDate);
        dataset.update({id: 1, content: model, start: start, end: end});
        var ct = timeline.getCustomTime(1);
        if (ct < start || ct > end) {
            timeline.setCustomTime(start, 1);
            timeline.setWindow(start.getTime() - ONE_YEAR_MS, end.getTime() + ONE_YEAR_MS);
        }
        var dateRange = dataset.get(2);
        if (dateRange.end < start || dateRange.start > end) {
            dataset.update({id: 2, start: start, end: end});
        }
        fetchDataForModel(model, data.minDate);
    }).fail(function(e) {
        alert("There was an error fetching data ranges for " + model + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

$("#model").change(function(e) {
    window.model = this.value;
    markers.clearLayers();
    markerLookup = [];
    fetchRangesForModel(this.value);
});

window.model = "Model_20CR";

fetchRangesForModel("Model_20CR")

$("#download").click(function() {
    var dt = dataset.get(2);
    var payload = {
        minDate: dt.start.formatYYYYMMDD() + " 12:00",
        maxDate: dt.end.formatYYYYMMDD() + " 12:00",
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
    }).fail(function(e) {
        var error = "There was an error exporting data for " + window.model + ": " + e.status + " " + e.statusText;
        alert(error);
        $("#download_status").html(error);
        console.error(e);
    });
})

Date.prototype.formatYYYYMMDD = function(){
    var day = ("0" + this.getDate()).slice(-2);
    var month = ("0" + (this.getMonth() + 1)).slice(-2);
    var year = this.getFullYear();
    return year + "-" + month + "-" + day;
}

// DOM element where the Timeline will be attached
var container = document.getElementById('timeline');

var dataset = new vis.DataSet([
    {id: 1, content: 'Data range', start: new Date(1871, 0, 1, 12), end: new Date(2100, 0, 1, 12), editable: false, selectable: false},
    {id: 2, content: 'Timeseries export range', start: new Date(1871, 0, 1, 12), end: new Date(1900, 0, 1, 12), editable: {updateTime: true, remove: false}}
]);

function updateTotalRows() {
    var days = $('#selected_days').text();
    var points = $('#selected_points').text();
    var total = days * points;
    $('#total_rows').text(total);
}

function updateSelectedDays() {
    var start = dataset.get(2).start;
    var end = dataset.get(2).end;
    var days = Math.round((end - start) / ONE_DAY_MS);
    $('#selected_days').text(days);
    updateTotalRows();
}

$("#start").change(function() {
    var bounds = dataset.get(1);
    var start = new Date(this.value);
    if (start < bounds.start) start = bounds.start;
    dataset.update({id: 2, start: start, end: dataset.get(2).end});
    updateSelectedDays();
});

$("#end").change(function() {
    var bounds = dataset.get(1);
    var end = new Date(this.value);
    if (end > bounds.end) end = bounds.end;
    dataset.update({id: 2, start: dataset.get(2).start, end: end});
    updateSelectedDays();
});

$("#download_info #start").val(dataset.get(2).start.formatYYYYMMDD());
$("#download_info #end").val(dataset.get(2).end.formatYYYYMMDD());
updateSelectedDays();

// Configuration for the Timeline
var options = {
    width: "100%",
    min: "1800-1-1",
    max: "2200-1-1",
    zoomable: true,
    zoomMin: 1000 * 60 * 60 * 24 * 7,
    editable: {
        updateTime: true,
        remove: false,
        overrideItems: false
    },
    snap: function (date, scale, step) {
        date.setHours(12, 0, 0, 0);
        return date;
    },
    onMoving: function (item, callback) {
        console.log(item, callback);
        var bounds = dataset.get(1);
        if (item.start < bounds.start) item.start = bounds.start;
        if (item.end > bounds.end) item.end = bounds.end;
        $("#download_info #start").val(item.start.formatYYYYMMDD());
        $("#download_info #end").val(item.end.formatYYYYMMDD());
        dataset.update({id: 2, start: item.start, end: item.end});
        updateSelectedDays();

        callback(item); // send back the (possibly) changed item
    },
};

// Create a Timeline
var timeline = new vis.Timeline(container, dataset, options);

timeline.setSelection(2);
timeline.on("select", function() {
    // enforce selection on range
    timeline.setSelection(2);
});

timeline.addCustomTime("1871-1-1 12:00", 1);

timeline.on('timechanged', function(e) {
    e.time.setHours(12, 0, 0, 0);
    timeline.setCustomTime(e.time, 1);
    var dateString = e.time.formatYYYYMMDD() + " 12:00";
    console.log("timechange", e, dateString);
    fetchDataForModel(window.model, dateString);
});

$(".vis-panel.vis-bottom").bind('wheel', function (event) {
    console.log("scroll on bottom");
    if (event.originalEvent.deltaY < 0) {
        timeline.zoomIn(1);
    } else {
        timeline.zoomOut(1);
    }
});

$(".vis-current-time").prepend('<img id="curDateImg" data-toggle="tooltip" data-placement="top" src="images/pin.svg" title="Current time: ' + new Date() + '"/>');

$('[data-toggle="tooltip"]').tooltip()