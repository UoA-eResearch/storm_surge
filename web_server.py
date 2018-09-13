#!/usr/bin/env python3

from bottle import Bottle, request, response, static_file
import bottle_mysql
import csv
import os
import sys
from datetime import datetime
import csv
from zipfile import ZipFile, ZIP_DEFLATED

application = Bottle()
plugin = bottle_mysql.Plugin(dbuser='storm_ro', dbpass='storm', dbname='storm')
application.install(plugin)

submodels = ["Historical", "rcp4.5", "rcp8.5"]

@application.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

@application.get('/')
def get(db):
    model = request.params.get('model', 'Model_20CR')
    submodel = 0
    if ' - ' in model:
        bits = model.split(' - ')
        model = bits[0]
        submodel = submodels.index(bits[1])
    bounds = request.params.get('bounds', "Polygon((160 -30.5,187 -30.5,187 -49.5,160 -49.5, 160 -30.5))")
    minDate = request.params.get('minDate', '1871-01-01 12:00')
    maxDate = request.params.get('maxDate', '1871-01-01 12:00')
    lltable = "f_latlng"
    if model == 'Model_20CR':
        lltable = "latlng"
    query = "SELECT ST_Y(l.latlng) AS lat, ST_X(l.latlng) AS lng, m.height, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime FROM `" + model + "` m INNER JOIN `" + lltable + "` l ON m.x = l.x AND m.y = l.y INNER JOIN date d ON m.z = d.id "
    query += "WHERE MBRContains(ST_GeomFromText('" + bounds + "'), l.latlng) AND l.offshore=1 AND d.datetime BETWEEN '" + minDate + "' AND '" + maxDate + "'"
    if model != 'Model_20CR':
        query += " AND m.model = {}".format(submodel)
    print(query)
    db.execute(query)
    results = db.fetchall()
    print("{} results".format(len(results)))
    response_format = request.params.get('format', 'json')
    if response_format == 'csv':
        dt = datetime.now().isoformat()
        filename = "{}_export_{}.csv".format(model, dt)
        filename_with_path = os.path.join("exports", filename)
        with open(filename_with_path, 'w') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=["lat", "lng", "datetime", "height"])
            writer.writeheader()
            writer.writerows(results)
        zipfilename = filename_with_path + ".zip"
        with ZipFile(zipfilename, "w", ZIP_DEFLATED) as zip:
            zip.write(filename_with_path, filename)
        return {"url": zipfilename}
    else:
        return {"results": results}

@application.get('/exports/<filename>')
def serve_export(filename):
    print("request for " + filename)
    return static_file(filename, root='exports')

@application.get('/ranges')
def get_ranges(db):
    model = request.params.get('model', 'Model_20CR')
    submodel = 0
    if ' - ' in model:
        bits = model.split(' - ')
        model = bits[0]
        submodel = submodels.index(bits[1])

    lltable = "f_latlng"
    if model == 'Model_20CR':
        lltable = "latlng"
    # Ensure indexes are used by avoiding joins
    query = "SELECT MIN(m.z) AS minZ, MAX(m.z) as maxZ FROM `" + model + "` m"
    if model != "Model_20CR":
        query += " WHERE m.model = {}".format(submodel)
    db.execute(query)
    result = db.fetchone()
    query = "SELECT MIN(x) AS minX, MAX(x) AS maxX, MIN(y) AS minY, MAX(y) AS maxY, MIN(ST_X(l.latlng)) AS minLng, MAX(ST_X(l.latlng)) AS maxLng, MIN(ST_Y(l.latlng)) AS minLat, MAX(ST_Y(l.latlng)) AS maxLat FROM `{}` l;".format(lltable);
    db.execute(query)
    ll = db.fetchone()
    result.update(ll)
    query = "SELECT DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') as minDate FROM date d WHERE d.id={};".format(result['minZ'])
    db.execute(query)
    minDate = db.fetchone()
    result.update(minDate)
    query = "SELECT DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') as maxDate FROM date d WHERE d.id={};".format(result['maxZ'])
    db.execute(query)
    maxDate = db.fetchone()
    result.update(maxDate)
    return result