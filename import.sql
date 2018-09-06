LOAD DATA INFILE '/var/lib/mysql-files/test.csv'
REPLACE INTO TABLE storm
COLUMNS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(@lat, @lng, @dt, height)
SET latlng = Point(@lng, @lat), datetime=STR_TO_DATE(@dt, '%Y-%c-%e-%H-%i-%s'), model='Model_20CR';