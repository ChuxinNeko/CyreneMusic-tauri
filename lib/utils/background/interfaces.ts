/**
 * 有一个 HTML 元素的接口
 */
export interface HasElement {
    /** 获取对应的 HTML 元素实例 */
    getElement(): HTMLElement;
}

/**
 * 实现了这个接口的对象需要在使用完毕后手动调用 dispose 销毁释放资源
 */
export interface Disposable {
    /** 销毁释放占用的资源 */
    dispose(): void;
}
