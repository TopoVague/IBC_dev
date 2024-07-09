from flask import Flask, request, render_template, send_file, jsonify
import ifcopenshell
import os
import time
import uuid
import tempfile
import logging

file1 = {
  "fileName": "WAL31",
  "IFCschema": 'IFC2X3',
  "country": "Switzerland"
} 
