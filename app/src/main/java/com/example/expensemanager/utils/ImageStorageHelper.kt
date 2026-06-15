package com.example.expensemanager.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.*

object ImageStorageHelper {
    fun saveImageToInternalStorage(context: Context, uri: Uri, folderName: String): String? {
        return try {
            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
            val originalBitmap = BitmapFactory.decodeStream(inputStream)
            
            val fileName = "${folderName}_${UUID.randomUUID()}.jpg"
            val directory = File(context.filesDir, folderName)
            if (!directory.exists()) directory.mkdirs()

            val file = File(directory, fileName)
            val outputStream = FileOutputStream(file)
            
            // Nén ảnh chất lượng 80% để tối ưu dung lượng
            originalBitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
            
            outputStream.flush()
            outputStream.close()
            inputStream?.close()

            file.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun saveBitmapToInternalStorage(context: Context, bitmap: Bitmap, folderName: String): String? {
        return try {
            val fileName = "${folderName}_${UUID.randomUUID()}.jpg"
            val directory = File(context.filesDir, folderName)
            if (!directory.exists()) directory.mkdirs()

            val file = File(directory, fileName)
            val outputStream = FileOutputStream(file)
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, outputStream)
            outputStream.flush()
            outputStream.close()
            file.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
