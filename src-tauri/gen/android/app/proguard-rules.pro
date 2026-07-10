# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Rust invokes these Android entry points through JNI by method name.
-keep class com.cyrenemusic.app.MainActivity {
    public void updateMediaNotification(java.lang.String);
    public void hideMediaNotification();
    public void setStatusBarDarkText(boolean);
    public java.lang.String installApkSync(java.lang.String);
    public void updateLyricNotification(java.lang.String);
    public void hideLyricNotification();
}

-keep class com.cyrenemusic.app.AndroidMediaNotificationManager { *; }
-keep class com.cyrenemusic.app.MediaPlaybackService { *; }
-keep class com.cyrenemusic.app.MediaActionReceiver { *; }
