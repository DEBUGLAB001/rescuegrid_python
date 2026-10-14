#!/bin/bash
export FLASK_APP=app.py
export FLASK_DEBUG=1
python -m flask --app app run --debug --reload --host 0.0.0.0 --port 5000
