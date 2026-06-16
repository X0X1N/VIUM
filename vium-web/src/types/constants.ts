/**
 * VIUM 충전기 커넥터 타입 매핑 상수
 * 한전(KEPCO) 공공데이터 코드와 서비스 UI 명칭을 연결합니다.
 */

// 1. 코드별 상세 명칭 (상세 모달용)
export const CONNECTOR_CODE_NAME: Record<string, string> = {
  '01': 'DC 차데모',
  '02': 'AC 완속',
  '03': 'AC 완속 (5핀)',
  '04': 'DC 콤보',
  '05': 'DC 차데모 + AC 3상',
  '06': 'DC 차데모 + DC 콤보',
  '07': 'DC 콤보 (CSS)',
  '08': 'DC 차데모 + DC 콤보 + AC 3상',
  '10': 'DC콤보+차데모+AC3상' // 멀티형 급속
};

// 2. UI 필터 ID별 매칭 코드 (필터 로직용)
// 사용자가 'DC Combo'를 선택했을 때 검색해야 할 코드들의 집합
export const FILTER_CONNECTOR_MAP: Record<string, string[]> = {
  'DC Combo': ['04', '06', '07', '08', '10'],
  'Chademo': ['01', '05', '06', '08', '10'],
  'AC 5핀': ['03'],
  'Slow': ['02', '03', '05', '08', '10'] // AC 3상 포함
};

/**
 * 커넥터 코드를 입력받아 사용자 친화적인 이름을 반환합니다.
 */
export const getConnectorName = (code: string): string => {
  return CONNECTOR_CODE_NAME[code] || `기타 (${code})`;
};
