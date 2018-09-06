#!/usr/bin/env python
from __future__ import print_function
from scipy.io import loadmat
import h5py

coords = loadmat('Coordinates.mat')
lons = coords['lon_nodes'].T
lats = coords['lat_nodes'].T
print("Lons", lons.shape, "Lats", lats.shape)

dates = loadmat('dates.mat')['dates']
print("Dates", dates.shape)

hdf = h5py.File("Model_20CR.mat", "r")
model = hdf.get('Model_20CR')

xl, yl, zl = model.shape
print("Model", xl, yl, zl)
print("Loading model to memory")
model = model[:]
print("Loaded!")

with open('out.csv', 'w') as f:
    f.write('lat,lng,datetime,height\n')
    for z in range(zl):
        datetime = "-".join([str(d) for d in dates[z]])
        for x in range(xl):
            for y in range(yl):
                lat = lats[x, y]
                lng = lons[x, y]
                height = model[x][y][z]
                f.write("{},{},{},{}\n".format(lat, lng, datetime, height))
        print("{}/{} ({}) done".format(z, zl, datetime))