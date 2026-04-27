import './popup/styles/global.css';

function IndexPopup() {
  return (
    <main className="min-w-[400px] min-h-[600px] bg-gray-50 text-gray-900 p-6">
      <section className="card flex h-full flex-col justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
            Beam It
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            开发环境已启动
          </h1>
          <p className="text-sm leading-6 text-gray-600">
            Popup 入口已恢复，后续可以继续接入视频检测与设备发现逻辑。
          </p>
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
          当前是最小可运行占位页，用于确认 Plasmo 开发服务器和扩展壳已正常工作。
        </div>
      </section>
    </main>
  );
}

export default IndexPopup;