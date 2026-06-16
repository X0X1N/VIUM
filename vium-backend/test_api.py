import requests
import json

def test_api():
    try:
        r = requests.get("http://localhost:8000/api/v1/stations")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Count: {len(data)}")
            if len(data) > 0:
                print(f"First Station: {data[0]['station_name']}")
        else:
            print(f"Error: {r.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_api()
