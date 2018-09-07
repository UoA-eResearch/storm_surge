#!/usr/bin/env python3
from __future__ import print_function
from scipy.io import loadmat
import h5py
import sys
import os
import pandas as pd
import numpy as np

model = sys.argv[1]

coords = loadmat('Coordinates.mat')
lons = coords['lon_nodes'].T
lats = coords['lat_nodes'].T
print("Lons", lons.shape, "Lats", lats.shape)

if model == 'latlng':
    i = 0
    with open('latlng.csv', 'w') as f:
        f.write('id,x,y,lat,lng\n')
        for x in range(lons.shape[0]):
            for y in range(lons.shape[1]):
                f.write("{},{},{},{},{}\n".format(i, x, y, lats[x, y], lons[x, y]))
                i += 1
    exit(1)

dates = pd.date_range("1871/1/1 12:00", "2100/1/1 12:00")

if model == 'dates':
    with open('dates.csv', 'w') as f:
        f.write('id,datetime\n')
        i = 0
        for dt in dates:
            f.write("{},{}\n".format(i,dt.strftime("%Y-%m-%d %H:%M:%S")))
            i += 1
    exit(1)

model_name = os.path.splitext(os.path.basename(model))[0]

def find_dt_offset(daterow):
    for i, date in enumerate(dates):
        if date.year == daterow[0] and date.month == daterow[1] and date.day == daterow[2]:
            return i
    return None

if model_name == 'Model_20CR':
    hdf = h5py.File(model, "r")
    model = hdf.get(model_name)

    print("Loading model to memory")
    model = model[:]
    print("Loaded!")
    xl, yl, zl = model.shape
    print("Model", xl, yl, zl)

    with open(model_name + '.csv', 'w') as f:
        f.write('x,y,z,height\n')
        for z in range(zl):
            for x in range(xl):
                for y in range(yl):
                    height = model[x][y][z]
                    f.write("{},{},{},{}\n".format(x, y, z, height))
            print("{}/{} done".format(z, zl))
else:
    model = loadmat(model)
    print(model.keys())
    rcp45 = model['ss_rcp45']
    rcp85 = model['ss_rcp85']
    hdstart = model['historical_dates'][0]
    fdstart = model['future_dates'][0]
    fzoffset = find_dt_offset(fdstart)
    hzoffset = find_dt_offset(hdstart)
    print("Offset of {} is {}".format(hdstart, hzoffset))
    latstart = model['lat'][0, 0]
    lonstart = model['lon'][0, 0]
    xoffset = np.where(lons == lonstart)[0][0]
    yoffset = np.where(lats == latstart)[1][0]
    print("Offset of {},{} is {},{}".format(latstart, lonstart, xoffset, yoffset))
    sshistorical = model['ss_historical']
    locallats = model['lat']
    zl = sshistorical.shape[0]
    xl, yl = locallats.T.shape
    with open(model_name + '.csv', 'w') as f:
        f.write("x,y,z,height,model\n")
        for z in range(zl):
            for x in range(xl):
                for y in range(yl):
                    hheight = sshistorical[z][x * yl + y]
                    f.write("{},{},{},{},{}\n".format(x+xoffset, y+yoffset, z+hzoffset, hheight, 0))
            print("{}/{} done".format(z, zl))
        zl = rcp45.shape[0]
        for z in range(zl):
            for x in range(xl):
                for y in range(yl):
                    rcp45height = rcp45[z][x * yl + y]
                    rcp85height = rcp85[z][x * yl + y]
                    f.write("{},{},{},{},{}\n".format(x+xoffset, y+yoffset, z+fzoffset, rcp45height, 1))
                    f.write("{},{},{},{},{}\n".format(x+xoffset, y+yoffset, z+fzoffset, rcp85height, 2))
            print("{}/{} done".format(z, zl))