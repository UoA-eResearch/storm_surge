#!/usr/bin/env python3

from bottle import Bottle, request, response
import bottle_mysql
import csv
import os
import sys

application = Bottle()
plugin = bottle_mysql.Plugin(dbuser='storm_ro', dbpass='storm', dbname='storm')
application.install(plugin)

@application.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

@application.get('/')
def get(db):
    model = request.params.get('model', 'Model_20CR')
    bounds = request.params.get('bounds', "Polygon((160 -30.5,187 -30.5,187 -49.5,160 -49.5, 160 -30.5))")
    mindate = request.params.get('mindate', '1871-01-01 12:00')
    maxdate = request.params.get('maxdate', '1871-01-01 12:00')
    lltable = "f_latlng"
    if model == 'model_20cr':
        lltable = "latlng"
    query = "SELECT ST_Y(l.latlng) AS lat, ST_X(l.latlng) AS lng, m.height, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS dt FROM `" + model + "` m INNER JOIN `" + lltable + "` l ON m.x = l.x AND m.y = l.y INNER JOIN date d ON m.z = d.id "
    query += "WHERE MBRContains(ST_GeomFromText('" + bounds + "'), l.latlng) AND d.datetime BETWEEN '" + mindate + "' AND '" + maxdate + "';"
    print(query)
    db.execute(query)
    results = db.fetchall()
    print("{} results".format(len(results)))
    return {"results": results}
