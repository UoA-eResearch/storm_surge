LOAD DATA INFILE '/home/nyou045/git/storm_surge/Model_20CR_test.csv'
REPLACE INTO TABLE storm
COLUMNS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(x, y, z, height)
SET model=0;