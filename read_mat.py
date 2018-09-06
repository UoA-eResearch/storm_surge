#!/usr/bin/env python
from __future__ import print_function
from scipy.io import loadmat
import h5py
import sys
import os

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

dates = loadmat('dates.mat')['dates']
print("Dates", dates.shape)

if model == 'dates':
    with open('dates.csv', 'w') as f:
        f.write('id,datetime\n')
        for z in range(dates.shape[0]):
            datetime = "-".join([str(d) for d in dates[z]])
            f.write("{},{}\n".format(z, datetime))
    exit(1)

hdf = h5py.File(model, "r")
model_name = os.path.splitext(os.path.basename(model))[0]
model = hdf.get(model_name)

xl, yl, zl = model.shape
print("Model", xl, yl, zl)
print("Loading model to memory")
model = model[:]
print("Loaded!")

with open(model_name + '.csv', 'w') as f:
    f.write('x,y,z,height\n')
    for z in range(zl):
        for x in range(xl):
            for y in range(yl):
                height = model[x][y][z]
                f.write("{},{},{},{}\n".format(x, y, z, height))
        print("{}/{} done".format(z, zl))