var map = L.map('map').setView([-41.235726,172.5118422], 6);

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
        polyline: false
    }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;

    drawnItems.addLayer(layer);
    console.log(layer);
});

var overlays = {
    "Drawn Items": drawnItems
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
    div.innerHTML = html;
    div.firstChild.onmousedown = div.firstChild.ondblclick = L.DomEvent.stopPropagation;
    return div;
};
legend.addTo(map);

function fetchDataForModel(model, mindate, maxdate) {
    if (!maxdate) {
        maxdate = mindate;
    }
    $.getJSON("https://r.nectar.auckland.ac.nz/storm/", { model: model, mindate: mindate, maxdate: maxdate }, function(data) {
        console.log(data);
    })
}

function fetchRangesForModel(model) {
    $.getJSON("https://r.nectar.auckland.ac.nz/storm/ranges", { model: model }, function(data) {
        fetchDataForModel(model, data.minDate);
    })
}

$("#model").change(function(e) {
    fetchRangesForModel(this.value);
});

fetchRangesForModel("Model_20CR")