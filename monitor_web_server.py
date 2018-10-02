#!/bin/bash
while true;do
  python3 -u ./web_server.py > webserver.log
  echo `date -Is` webserver crashed - restarting
  sleep 1
done
