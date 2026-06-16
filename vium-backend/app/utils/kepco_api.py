import os
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

class KepcoAPIClient:
    """
    전력데이터 개방 포털시스템(Big Data Portal) 사양에 맞춘 API 클라이언트입니다.
    사용자가 제공한 https://bigdata.kepco.co.kr 사양을 엄격히 준수합니다.
    """
    
    def __init__(self):
        # .env에서 apiKey를 가져옵니다.
        self.api_key = os.getenv("KEPCO_API_KEY")
        # 1. 전기차 충전소 운영정보 (실시간 상태 및 상세 정보)
        self.operation_url = "https://bigdata.kepco.co.kr/openapi/v1/EVchargeManage.do"
        # 2. 전기차 충전소 설치현황 (통계 및 위치 정보)
        self.installation_url = "https://bigdata.kepco.co.kr/openapi/v1/EVcharge.do"

    def fetch_stations_by_addr(self, addr: str = "양주시") -> List[Dict[str, Any]]:
        """
        [운영정보 API] 특정 주소(addr)를 기준으로 실시간 충전소 상태를 가져옵니다.
        사양: apiKey(필수), addr(선택), returnType(선택, 기본 json)
        """
        if not self.api_key or "YOUR_DECODED" in self.api_key:
            print("[KepcoAPI] 경고: 유효한 API 키가 설정되지 않았습니다.")
            return []

        params = {
            "apiKey": self.api_key,
            "addr": addr,
            "returnType": "json"
        }

        try:
            print(f"[KepcoAPI] 요청 전송: {self.operation_url} (지역: {addr})")
            response = requests.get(self.operation_url, params=params, timeout=30)
            
            if response.status_code == 200:
                json_data = response.json()
                if "data" in json_data:
                    return json_data["data"]
                else:
                    print(f"[KepcoAPI] 정보: 검색 결과가 없습니다. (Response: {json_data})")
                    return []
            else:
                print(f"[KepcoAPI] 에러: API 호출 실패 (Status: {response.status_code})")
                return []
                
        except requests.exceptions.Timeout:
            print("[KepcoAPI] 에러: 한전 서버 응답 시간 초과 (30초)")
            return []
        except Exception as e:
            print(f"[KepcoAPI] 예외 발생: {e}")
            return []

    def fetch_installation_status(self, metro_cd: str = "31") -> List[Dict[str, Any]]:
        """
        [설치현황 API] 광역시도 코드(metroCd)를 기준으로 설치 현황을 가져옵니다.
        경기: 31, 서울: 11 등
        """
        if not self.api_key: return []

        params = {
            "apiKey": self.api_key,
            "metroCd": metro_cd,
            "returnType": "json"
        }

        try:
            response = requests.get(self.installation_url, params=params, timeout=30)
            if response.status_code == 200:
                return response.json().get("data", [])
        except Exception as e:
            print(f"[KepcoAPI] 설치현황 조회 중 예외: {e}")
        return []

# 싱글톤 인스턴스
kepco_client = KepcoAPIClient()
