'use client'

/**
 * antd icons for Server Components. `@ant-design/icons` reads React context, which a Server
 * Component cannot, so a server file imports its icons from here: this module is a client
 * boundary and each icon renders as a client reference. Client components import from
 * `@ant-design/icons` directly.
 */
export {
  ArrowRightOutlined,
  BgColorsOutlined,
  CameraOutlined,
  CheckOutlined,
  DragOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileOutlined,
  FilePdfOutlined,
  FontSizeOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
} from '@ant-design/icons'
