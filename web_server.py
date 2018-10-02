#!/usr/bin/env python3

from bottle import Bottle, request, response, static_file, run, abort
import bottle_mysql
import csv
import os
import sys
from datetime import datetime
import csv
from zipfile import ZipFile, ZIP_DEFLATED
import time
import json

from gevent.pywsgi import WSGIServer
from geventwebsocket import WebSocketError
from geventwebsocket.handler import WebSocketHandler

application = Bottle()
plugin = bottle_mysql.Plugin(dbuser='storm_ro', dbpass='storm', dbname='storm', dbhost='stormsurge.nectar.auckland.ac.nz')
application.install(plugin)

submodels = ["Historical", "rcp4.5", "rcp8.5"]
submodelExportNames = ["HIST", "rcp45", "rcp85"]
CHUNKSIZE = 1000

@application.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

def getParamsOrDefaults(params):
    if 'model' not in params:
        params['model'] = 'Model_20CR'
        params['submodel'] = 0
    else:
        if ' - ' in params['model']:
            bits = params['model'].split(' - ')
            params['model'] = bits[0]
            params['submodel'] = submodels.index(bits[1])
        else:
            params['submodel'] = 0
    if 'bounds' not in params:
        params['bounds'] = "Polygon((160 -30.5,187 -30.5,187 -49.5,160 -49.5, 160 -30.5))"
    if 'minDate' not in params:
        params['minDate'] = '1871-01-01 12:00'
    if 'maxDate' not in params:
        params['maxDate'] = '1871-01-01 12:00'
    if 'format' not in params:
        params['format'] = 'json'
    return params

def getQueryForParams(params):
    lltable = "f_latlng"
    if params['model'] == 'Model_20CR':
        lltable = "latlng"
    fromwhere = " FROM `" + params['model'] + "` m INNER JOIN `" + lltable + "` l ON m.x = l.x AND m.y = l.y INNER JOIN date d ON m.z = d.id "
    fromwhere += "WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlng) AND l.offshore=1 AND d.datetime BETWEEN '" + params['minDate'] + "' AND '" + params['maxDate'] + "'"
    if params['model'] != 'Model_20CR':
        fromwhere += " AND m.model = {}".format(params['submodel'])
    return fromwhere

def getFilenameForParams(params, ext = 'csv'):
    latlng = params['bounds'].split(",")[1].strip().split(" ")
    lng = float(latlng[0])
    lat = float(latlng[1])
    latS = "{0:05.1f}".format(abs(lat)).replace(".","")
    lngS = "{0:05.1f}".format(abs(lng)).replace(".","")
    if lat < 0:
        latS += "S"
    else:
        latS += "N"
    if lng < 0:
        lngS += "W"
    else:
        lngS += "E"
    filename = "{}-{}-{}-{}-{}{}.{}".format(
        params['model'],
        submodelExportNames[params['submodel']],
        params['minDate'][:params['minDate'].index(" ")].replace("-", ""),
        params['maxDate'][:params['maxDate'].index(" ")].replace("-", ""),
        lngS,
        latS,
        ext
    )
    return filename

def writeCSV(filename, results):
    filename_with_path = os.path.join("exports", filename)
    with open(filename_with_path, 'w') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["lat", "lng", "datetime", "height"])
        writer.writeheader()
        writer.writerows(results)
    zipfilename = filename_with_path.replace(".csv", ".zip")
    with ZipFile(zipfilename, "w", ZIP_DEFLATED) as zip:
        zip.write(filename_with_path, filename)
    os.remove(filename_with_path)
    return zipfilename

@application.get('/')
def get(db):
    s = time.time()
    params = getParamsOrDefaults(request.params)
    fromwhere = getQueryForParams(params)
    query = "SELECT ST_Y(l.latlng) AS lat, ST_X(l.latlng) AS lng, m.height, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime" + fromwhere
    db.execute(query)
    print("{}s - query executed".format(time.time() - s))
    results = db.fetchall()
    print("{}s - all {} results fetched".format(time.time() - s, len(results)))
    if params['format'] == 'csv':
        filename = getFilenameForParams(params)
        zipfilename = writeCSV(filename, results)
        return {"url": zipfilename}
    else:
        return {"results": results}

@application.route('/websocket')
def handle_websocket(db):
    wsock = request.environ.get('wsgi.websocket')
    if not wsock:
        abort(400, 'Expected WebSocket request.')

    while True:
        try:
            s = time.time()
            message = wsock.receive()
            try:
                params = json.loads(message)
            except:
                wsock.send('{"error": "unable to parse JSON"}')
                continue
            params = getParamsOrDefaults(params)
            fromwhere = getQueryForParams(params)
            countquery = "SELECT COUNT(*) as count" + fromwhere
            db.execute(countquery)
            count = db.fetchone()['count']
            print("{}s - {} results to fetch".format(time.time() - s, count))
            results = []
            query = "SELECT ST_Y(l.latlng) AS lat, ST_X(l.latlng) AS lng, m.height, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime" + fromwhere + " LIMIT " + str(CHUNKSIZE)
            for i in range(0, count, CHUNKSIZE):
                db.execute(query + " OFFSET " + str(i))
                print("{}s - query for chunk executed".format(time.time() - s, i))
                theseresults = db.fetchall()
                results.extend(theseresults)
                pct_done = float(i) / float(count)
                wsock.send(str(pct_done))
            print("{}s - all {} results fetched".format(time.time() - s, len(results)))
            if params['format'] == 'csv':
                filename = getFilenameForParams(params)
                zipfilename = writeCSV(filename, results)
                wsock.send(zipfilename)
            else:
                wsock.send(json.dumps(results))
        except WebSocketError:
            break

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

if __name__ == "__main__":
    server = WSGIServer(("localhost", 8081), application,
                    handler_class=WebSocketHandler)
    print("up")
    server.serve_forever()