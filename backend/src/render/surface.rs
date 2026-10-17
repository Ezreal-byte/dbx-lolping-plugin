//! OS-owned transparent surfaces; there is no browser, GPU device, or swapchain.
//! Pixels are premultiplied RGBA. Windows DIBs use BGRA, CoreGraphics uses RGBA.
use super::Bounds;
use tao::window::Window;
use tiny_skia::Pixmap;

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::{ffi::c_void, mem::size_of, ptr};
    use tao::platform::windows::WindowExtWindows;
    use windows_sys::Win32::{
        Foundation::{POINT, SIZE},
        Graphics::{Dwm::*, Gdi::*},
        UI::WindowsAndMessaging::*,
    };
    pub struct Surface {
        dc: HDC,
        bitmap: HBITMAP,
        old: HGDIOBJ,
        bits: *mut c_void,
        size: (u32, u32),
        geometry: Option<(i32, i32, u32, u32)>,
    }
    impl Surface {
        pub fn new(window: &Window) -> Result<Self, String> {
            unsafe {
                let hwnd = window.hwnd() as _;
                // Tao hides the title bar via WM_NCCALCSIZE but retains WS_CAPTION.
                // DWM can still draw a rounded border/shadow around the rectangular
                // surface, even when all edge pixels have zero alpha. Disable that
                // independently of the styles Tao reapplies on show/hide.
                let policy = DWMNCRP_DISABLED;
                let result = DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_NCRENDERING_POLICY as u32,
                    &policy as *const _ as _,
                    size_of::<i32>() as u32,
                );
                if result < 0 {
                    return Err(format!("disableOverlayFrame: {result:#x}"));
                }
                // These Windows 11 attributes are optional on older Windows.
                let corners = DWMWCP_DONOTROUND;
                DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_WINDOW_CORNER_PREFERENCE as u32,
                    &corners as *const _ as _,
                    size_of::<i32>() as u32,
                );
                let border: u32 = 0xfffffffe; // DWMWA_COLOR_NONE
                DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_BORDER_COLOR as u32,
                    &border as *const _ as _,
                    size_of::<u32>() as u32,
                );
                // Per-pixel layered composition supplies transparency; Tao's DWM
                // blur-behind setup is unnecessary for this rendering path.
                let blur = DWM_BLURBEHIND {
                    dwFlags: DWM_BB_ENABLE,
                    ..std::mem::zeroed()
                };
                DwmEnableBlurBehindWindow(hwnd, &blur);
                // Tao's cursor-ignore path can set a constant-alpha layered window.
                // Reset WS_EX_LAYERED before using per-pixel UpdateLayeredWindow.
                let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style & !(WS_EX_LAYERED as isize));
                SetWindowLongPtrW(
                    hwnd,
                    GWL_EXSTYLE,
                    style
                        | (WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW)
                            as isize,
                );
                let dc = CreateCompatibleDC(ptr::null_mut());
                if dc.is_null() {
                    return Err(std::io::Error::last_os_error().to_string());
                }
                Ok(Self {
                    dc,
                    bitmap: ptr::null_mut(),
                    old: ptr::null_mut(),
                    bits: ptr::null_mut(),
                    size: (0, 0),
                    geometry: None,
                })
            }
        }
        fn release_bitmap(&mut self) {
            unsafe {
                if !self.bitmap.is_null() {
                    SelectObject(self.dc, self.old);
                    DeleteObject(self.bitmap);
                }
            }
            self.bitmap = ptr::null_mut();
            self.bits = ptr::null_mut();
            self.size = (0, 0);
        }
        pub fn clear(&mut self, _window: &Window) {
            self.release_bitmap();
            self.geometry = None;
        }
        pub fn bytes(&self) -> usize {
            self.size.0 as usize * self.size.1 as usize * 4
        }
        pub fn system_frame(&self, window: &Window) -> Option<bool> {
            let mut enabled: i32 = 0;
            let result = unsafe {
                DwmGetWindowAttribute(
                    window.hwnd() as _,
                    DWMWA_NCRENDERING_ENABLED as u32,
                    &mut enabled as *mut _ as _,
                    size_of::<i32>() as u32,
                )
            };
            (result >= 0).then_some(enabled != 0)
        }
        pub fn present(
            &mut self,
            window: &Window,
            pixels: &Pixmap,
            b: Bounds,
            origin: (i32, i32),
        ) -> Result<(), String> {
            unsafe {
                if self.size != (b.w, b.h) {
                    self.release_bitmap();
                    let info = BITMAPINFO {
                        bmiHeader: BITMAPINFOHEADER {
                            biSize: size_of::<BITMAPINFOHEADER>() as u32,
                            biWidth: b.w as i32,
                            biHeight: -(b.h as i32),
                            biPlanes: 1,
                            biBitCount: 32,
                            biCompression: BI_RGB,
                            ..std::mem::zeroed()
                        },
                        ..std::mem::zeroed()
                    };
                    let bitmap = CreateDIBSection(
                        self.dc,
                        &info,
                        DIB_RGB_COLORS,
                        &mut self.bits,
                        ptr::null_mut(),
                        0,
                    );
                    if bitmap.is_null() {
                        return Err(std::io::Error::last_os_error().to_string());
                    }
                    self.bitmap = bitmap;
                    self.old = SelectObject(self.dc, bitmap);
                    self.size = (b.w, b.h);
                }
                let output = std::slice::from_raw_parts_mut(self.bits as *mut u8, self.bytes());
                for (src, dst) in pixels
                    .data()
                    .chunks_exact(4)
                    .zip(output.chunks_exact_mut(4))
                {
                    dst.copy_from_slice(&[src[2], src[1], src[0], src[3]]);
                }
                let pos = POINT {
                    x: origin.0 + b.x,
                    y: origin.1 + b.y,
                };
                let size = SIZE {
                    cx: b.w as i32,
                    cy: b.h as i32,
                };
                let from = POINT { x: 0, y: 0 };
                let blend = BLENDFUNCTION {
                    BlendOp: AC_SRC_OVER as u8,
                    BlendFlags: 0,
                    SourceConstantAlpha: 255,
                    AlphaFormat: AC_SRC_ALPHA as u8,
                };
                let geometry = (pos.x, pos.y, b.w, b.h);
                if self.geometry != Some(geometry) {
                    // Establish the complete destination before uploading pixels. Resizing/moving
                    // only through UpdateLayeredWindow can retain the previous clipped visible
                    // region (e.g. a half-wheel at the monitor edge), even though GetWindowRect
                    // reports the new size. Do not preserve old client pixels across this change.
                    if SetWindowPos(
                        window.hwnd() as _,
                        ptr::null_mut(),
                        pos.x,
                        pos.y,
                        size.cx,
                        size.cy,
                        SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOCOPYBITS,
                    ) == 0
                    {
                        return Err(std::io::Error::last_os_error().to_string());
                    }
                }
                if UpdateLayeredWindow(
                    window.hwnd() as _,
                    ptr::null_mut(),
                    &pos,
                    &size,
                    self.dc,
                    &from,
                    0,
                    &blend,
                    ULW_ALPHA,
                ) == 0
                {
                    return Err(std::io::Error::last_os_error().to_string());
                }
                self.geometry = Some(geometry);
                Ok(())
            }
        }
    }
    impl Drop for Surface {
        fn drop(&mut self) {
            self.release_bitmap();
            unsafe {
                DeleteDC(self.dc);
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use objc2::{msg_send, runtime::AnyObject};
    use std::{ffi::c_void, ptr};
    use tao::{
        dpi::{PhysicalPosition, PhysicalSize},
        platform::macos::WindowExtMacOS,
    };
    type Ref = *const c_void;
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGColorSpaceCreateDeviceRGB() -> Ref;
        fn CGColorSpaceRelease(space: Ref);
        fn CGDataProviderCreateWithData(
            info: *mut c_void,
            data: Ref,
            size: usize,
            release: Option<unsafe extern "C" fn(*mut c_void, Ref, usize)>,
        ) -> Ref;
        fn CGDataProviderRelease(provider: Ref);
        fn CGImageCreate(
            w: usize,
            h: usize,
            bits: usize,
            pixel_bits: usize,
            row: usize,
            space: Ref,
            bitmap_info: u32,
            provider: Ref,
            decode: Ref,
            interpolate: bool,
            intent: u32,
        ) -> Ref;
        fn CGImageRelease(image: Ref);
    }
    #[link(name = "QuartzCore", kind = "framework")]
    extern "C" {}
    // The provider owns the boxed byte slice until CALayer releases the image.
    unsafe extern "C" fn release_pixels(_info: *mut c_void, data: Ref, len: usize) {
        drop(Box::from_raw(ptr::slice_from_raw_parts_mut(
            data as *mut u8,
            len,
        )));
    }
    pub struct Surface {
        layer: *mut AnyObject,
        size: (u32, u32),
    }
    impl Surface {
        pub fn system_frame(&self, _window: &Window) -> Option<bool> {
            None // DWM diagnostic only applies to Windows.
        }
        pub fn new(window: &Window) -> Result<Self, String> {
            unsafe {
                let view = window.ns_view() as *mut AnyObject;
                let _: () = msg_send![view,setWantsLayer:true];
                let layer: *mut AnyObject = msg_send![view, layer];
                if layer.is_null() {
                    return Err("missingNativeLayer".into());
                }
                let _: () = msg_send![layer,setOpaque:false];
                let _: () = msg_send![layer,setContentsScale:window.scale_factor()];
                Ok(Self {
                    layer,
                    size: (0, 0),
                })
            }
        }
        pub fn clear(&mut self, _window: &Window) {
            unsafe {
                let _: () = msg_send![self.layer,setContents:ptr::null::<AnyObject>()];
            }
            self.size = (0, 0);
        }
        pub fn bytes(&self) -> usize {
            self.size.0 as usize * self.size.1 as usize * 4
        }
        pub fn present(
            &mut self,
            window: &Window,
            pixels: &Pixmap,
            b: Bounds,
            origin: (i32, i32),
        ) -> Result<(), String> {
            // Tao converts top-left global physical pixels to AppKit points, including negative monitors.
            window.set_outer_position(PhysicalPosition::new(origin.0 + b.x, origin.1 + b.y));
            if self.size != (b.w, b.h) {
                window.set_inner_size(PhysicalSize::new(b.w, b.h));
            }
            unsafe {
                let space = CGColorSpaceCreateDeviceRGB();
                let bytes = pixels.data().to_vec().into_boxed_slice();
                let len = bytes.len();
                let data = Box::into_raw(bytes) as *const u8;
                let provider = CGDataProviderCreateWithData(
                    ptr::null_mut(),
                    data as Ref,
                    len,
                    Some(release_pixels),
                );
                if provider.is_null() {
                    release_pixels(ptr::null_mut(), data as Ref, len);
                    CGColorSpaceRelease(space);
                    return Err("nativeImageProvider".into());
                }
                // kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big = RGBA byte order.
                let image = CGImageCreate(
                    b.w as usize,
                    b.h as usize,
                    8,
                    32,
                    b.w as usize * 4,
                    space,
                    1 | (4 << 12),
                    provider,
                    ptr::null(),
                    true,
                    0,
                );
                CGDataProviderRelease(provider);
                CGColorSpaceRelease(space);
                if image.is_null() {
                    return Err("nativeImage".into());
                }
                let transaction = objc2::class!(CATransaction);
                let _: () = msg_send![transaction, begin];
                let _: () = msg_send![transaction,setDisableActions:true];
                let _: () = msg_send![self.layer,setContentsScale:window.scale_factor()];
                let _: () = msg_send![self.layer,setContents:image as *const AnyObject];
                let _: () = msg_send![transaction, commit];
                CGImageRelease(image);
                self.size = (b.w, b.h);
            }
            Ok(())
        }
    }
}
pub use platform::Surface;
