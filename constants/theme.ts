// Hệ màu cho ứng dụng Quản lý Nông nghiệp Thông minh AIoT
// Phong cách Bắc Âu (Scandinavian Sage & Linen) - Tinh tế, nhẹ nhàng, organic và hiện đại.

export const colors = {
  // Nền / Bề mặt (Light & Soft)
  bg: '#F6F8F5',           // Nền xám ngọc trai pha ánh xanh rêu siêu nhẹ, dịu mắt
  surface: '#FFFFFF',      // Thẻ trắng tinh tế
  surfaceAlt: '#EEF3EE',   // Thẻ nhấn / Chip phụ
  surfaceLight: '#FFFFFF',
  card: '#FFFFFF',

  // Thương hiệu (Sage Green Bắc Âu)
  primary: {
    50: '#F0F7F2',
    100: '#DCEDE0',
    200: '#B9DEC2',
    300: '#8CC79A',
    400: '#4A9E66',
    500: '#2D6A4F',        // Màu chủ đạo Sage Green sang trọng
    600: '#24553F',
    700: '#1C4332',
    800: '#143124',
    900: '#0D2018',
  },
  accent: {
    400: '#4EAF95',
    500: '#2D8A74',
    600: '#206A58',
  },
  water: {
    400: '#52A2C7',
    500: '#2E86AB',        // Xanh lam dịu
    600: '#21637F',
  },
  soil: {
    400: '#A18276',
    500: '#8D6E63',        // Nâu đất ấm
    600: '#6D4C41',
  },
  sun: {
    400: '#E59B3C',
    500: '#D9822B',        // Hổ phách ấm
    600: '#B86A1B',
  },

  // Trạng thái (Soft status tones)
  success: '#2D6A4F',      // Xanh xô thơm
  warning: '#D9822B',      // Hổ phách
  danger: '#D64045',       // Đỏ san hô trầm
  info: '#2E86AB',         // Lam dịu

  // Chữ & Viền (High readability & elegance)
  text: '#1E2D24',         // Đen ánh rêu đậm, sắc nét nhưng không gắt
  textMuted: '#6B7F74',    // Xám rêu trung tính, thanh lịch
  textLight: '#FFFFFF',
  textDark: '#1E2D24',
  textDarkMuted: '#6B7F74',
  border: '#E3ECE5',       // Viền mỏng mềm mại
  borderLight: '#EBF2EC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontFamily: 'Inter-Bold', fontSize: 28, lineHeight: 34 },
  h1: { fontFamily: 'Inter-Bold', fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: 'Inter-SemiBold', fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: 'Inter-SemiBold', fontSize: 17, lineHeight: 23 },
  body: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter-Medium', fontSize: 12, lineHeight: 16 },
  bigNumber: { fontFamily: 'Inter-Bold', fontSize: 34, lineHeight: 38 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  soft: {
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
