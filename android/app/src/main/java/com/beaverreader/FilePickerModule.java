package com.beaverreader;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.database.Cursor;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class FilePickerModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final int PICK_FILE_REQUEST = 1;
    private Promise mPickerPromise;

    public FilePickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
    }

    @NonNull
    @Override
    public String getName() {
        return "FilePicker";
    }

    @ReactMethod
    public void pickFile(Promise promise) {
        Activity currentActivity = getCurrentActivity();

        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist");
            return;
        }

        mPickerPromise = promise;

        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            String[] mimeTypes = {"application/pdf", "application/epub+zip"};
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            intent.addCategory(Intent.CATEGORY_OPENABLE);

            currentActivity.startActivityForResult(intent, PICK_FILE_REQUEST);
        } catch (Exception e) {
            mPickerPromise.reject("E_FAILED_TO_SHOW_PICKER", e);
            mPickerPromise = null;
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE_REQUEST) {
            if (mPickerPromise != null) {
                if (resultCode == Activity.RESULT_CANCELED) {
                    mPickerPromise.reject("E_PICKER_CANCELLED", "User cancelled file picker");
                } else if (resultCode == Activity.RESULT_OK) {
                    Uri uri = data.getData();
                    if (uri == null) {
                        mPickerPromise.reject("E_NO_FILE_SELECTED", "No file was selected");
                        return;
                    }

                    try {
                        WritableMap result = Arguments.createMap();
                        
                        // Get file name
                        String fileName = getFileName(uri);
                        result.putString("name", fileName);
                        result.putString("uri", uri.toString());
                        
                        // Determine file type
                        String fileType = fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
                        result.putString("type", fileType);
                        
                        // Copy file to internal storage
                        String localPath = copyFileToInternalStorage(uri, fileName);
                        result.putString("path", localPath);
                        
                        mPickerPromise.resolve(result);
                    } catch (Exception e) {
                        mPickerPromise.reject("E_FILE_COPY_FAILED", e);
                    }
                }
                mPickerPromise = null;
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {}

    private String getFileName(Uri uri) {
        String result = null;
        if (uri.getScheme().equals("content")) {
            Cursor cursor = getReactApplicationContext().getContentResolver().query(uri, null, null, null, null);
            try {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        result = cursor.getString(nameIndex);
                    }
                }
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result;
    }

    private String copyFileToInternalStorage(Uri uri, String fileName) throws Exception {
        File booksDir = new File(getReactApplicationContext().getFilesDir(), "books");
        if (!booksDir.exists()) {
            booksDir.mkdirs();
        }

        // Generate unique filename
        String timestamp = String.valueOf(System.currentTimeMillis());
        String uniqueFileName = timestamp + "_" + fileName;
        File destFile = new File(booksDir, uniqueFileName);

        InputStream inputStream = getReactApplicationContext().getContentResolver().openInputStream(uri);
        FileOutputStream outputStream = new FileOutputStream(destFile);

        byte[] buffer = new byte[1024];
        int length;
        while ((length = inputStream.read(buffer)) > 0) {
            outputStream.write(buffer, 0, length);
        }

        outputStream.flush();
        outputStream.close();
        inputStream.close();

        return destFile.getAbsolutePath();
    }
}
