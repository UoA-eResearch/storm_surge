# storm_surge
Tools to store / view / subset / download storm surge data

## How it works

1. `read_mat.py` is used to read Matlab / HDF5 files and convert them to CSV.  
2. The CSVs are imported into MySQL using the LOAD DATA INFILE command - see `import.sql` for an example  
3. The tables are indexed  
4. `web_server.py` acts as REST endpoints for accessing / exporting data from MySQL, and can return data either as JSON or a zipped CSV  
5. `index.html` and `js/custom.js` act as a frontend that uses the above REST endpoints  